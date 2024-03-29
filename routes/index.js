const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');
const Like = require('../models/like');
const dayjs = require('dayjs');
const Op = require('sequelize').Op;
const bcrypt = require('bcrypt');

/**
 * @swagger
 * /login:
 *   post:
 *     summary: 로그인.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               password:
 *                 type: string
 *     responses: 
 *       '200':
 *         description: 로그인 성공
 */
router.post('/login', (req, res) => {
  passport.authenticate('local', { session: false }, (err, user) => {
    if (err || !user) {
      return res.status(400).json({
        message: 'error',
        user
      })
    }
    req.login(user, { session: false }, (err) => {
      if (err) {
        res.send(err);
      }
      const token = jwt.sign(user.toJSON(), 'randomString');

      return res.json(((user, token)))
    });
  })(req, res);
})

router.post('/signup', async (req, res) => {
  const { id, password } = req.body;
  const createdUser = await User.create({ user_id: id, password: await bcrypt.hash(password, 12) });
  // await createdUser.save()
  res.status(201).send(createdUser);
});
router.get('/test', passport.authenticate('jwt', { session: false }),
  async (req, res, next) => {
    res.send()
  }
)
/**
 * @swagger
 *  /login:
 *    get:
 *      tags:
 *      - login
 *      description: 로그인
 *      produces:
 *      - application/json
 *      parameters:
 *        - in: query
 *          name: category
 *          required: false
 *          schema:
 *            type: integer
 *            description: 카테고리
 *      responses:
 *       200:
 *        description: 제품 조회 성공
 */
router.post('/post', passport.authenticate('jwt', { session: false }),
  async (req, res, next) => {
    const { title, content } = req.body
    const payload = { title, content, poster: req.user.id}
    const post = await Post.create(payload)
    if (post) {
      // await post.save()
      res.status(201).send(post)
    }
    else res.status(404).send()
  }
)
  
const filterComment = (comment) => {
  const bannedWords = ['banned', 'test2', 'random']
  const isValid = bannedWords.every(word => {
    return !comment.includes(word)
  })
  return isValid
}

const checkSpam = async (commenter, postId) => {
  const from = dayjs().subtract(5, 'seconds').toDate()
  const comment = await Comment.findAndCountAll({ 
    where: {
      postId,
      commenter,
      created_at: {
        [Op.between]: [from, dayjs().toDate()],
      } 
    }
  })
  return comment.count > 5
}
router.post('/comment', passport.authenticate('jwt', { session: false }),
  async (req, res, next) => {
    const { comment, postId } = req.body;
    const commenter = req.user.dataValues.id
    const isSpam = await checkSpam(commenter, postId)
    const isValid = filterComment(comment)

    if (!isValid || isSpam) {
      res.status(304).send(isValid)
      return
    }

    const payload = { comment, commenter: req.user.id, postId};
    const createdComment = await Comment.create(payload);
    // await createdComment.save()
    res.status(201).send(createdComment);
  }
  )
router.patch('/comment', passport.authenticate('jwt', { session: false }),
  async (req, res, next) => {
    const { commentId, comment } = req.body
    const isValid = filterComment(comment)

    if (!isValid) {
      res.status(304).send(isValid)
      return
    }

    const updatedComment = await Comment.update({ comment }, { where: { id:commentId }})

    if (updatedComment) {
      res.status(204).send()
    } else {
      res.status(404).send()
    }
  }
)
router.delete('/comment/:commentId', passport.authenticate('jwt', { session: false }),
  async (req, res, next) => {
    const { commentId } = req.params
    const deletedComment = await Comment.destroy({ where: { id: commentId }})
    if (deletedComment) {
      res.status(204).send()
    } else {
      res.status(404).send()
    }
  }
)
router.post('/like', passport.authenticate('jwt', { session: false }),
  async (req, res, next) => {
    const { commentId, isLike } = req.body
    const like = await Like.findOne({ where: { commentId }})
    const target = await Comment.findOne({ where: { id: commentId }})

    if (!like) {
      const payload = {
        isLike 
      }
      const createdLike = await Like.create(payload)
      if (createdLike) {
        if (isLike) {
          await target.update({likeCount: 1})
        } else {
          await target.update({dislikeCount: 1})
        }
        res.status(201).send(isLike)
      } else {
        res.status(500).send(isLike)
      }
      return
    }
    if (like) {
      if (like.isLike === isLike) {
        res.status(304).send(isLike);
        return
      } else {
        await Like.update({ isLike }, { where: { commentId }})
        if (isLike) {
          await target.update({likeCount: target.likeCount + 1})
        } else {
          await target.update({likeCount: target.dislikeCount + 1})
        }
        res.status(204).send(isLike);
      }
    }
    res.status(200).send()
  }

)
router.get('/comments/:postId/:filter?', async (req, res, next) => {
    const { postId, filter } = req.params
    const findOptions = { where: { postId }, order: [['created_at', 'DESC']] }

    if (filter === 'oldest') findOptions.order = [['created_at', 'ASC']]
    if (filter === 'popular') findOptions.order = [['like_count', 'DESC']]

    const comments = await Comment.findAndCountAll(findOptions);
    res.status(200).send({ comments: comments.rows, count:comments.count })
  }
)

module.exports = router;
