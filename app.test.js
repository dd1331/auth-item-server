const request = require('supertest');
const app = require('./app');
const db = require('./models');
const each = require('jest-each').default;

describe('test', () => {
	let token;
	let createdPost;
	let createdComments = [];
	let createdUser;
	beforeAll(async () => {
		await db.sequelize.sync({ force: true })
			.then((res) => {
				// console.log('database connected')
			}).catch(err => {
				console.log('err', err)
		})
	});
	afterAll( async () => {
		await db.sequelize.close()
	})
	describe('signup', () => {
		it('signup', async () => {
			const payload = {
				id: 'test',
				password: '1331'
			}
			const { body, status} = await request(app).post('/signup').send(payload);
			expect(status).toBe(201)
			createdUser = body;
		});
	});	
	describe('login', () => {
		const loginParams = [
			{ id: 'wrongId', password: '1331' },
			{ id: 'test', password: 'wrongPassword' },
			{ id: 'test', password: '' },
			{ id: '', password: 'wrongPassword' }
		]
		each(loginParams).it('login failed', async (payload) => {
			const res = await request(app).post('/login').send(payload)
			expect(res.status).toBe(400)
		})
		it('login succeed', async () => {
			const payload = {
				id: 'test',
				password: '1331'
			}
			const res = await request(app).post('/login').send(payload)
			token = res.body
			expect(res.status).toBe(200)
		})
	});
	describe('post', () => {
		it('post', async () => {
			const payload = {
				title: 'test ttitle',
				content: 'test content'
			}
			await request(app).post('/post').set('Authorization', `Bearer ${token}`).send(payload)
			await request(app).post('/post').set('Authorization', `Bearer ${token}`).send(payload)
			const { body, status } = await request(app).post('/post').set('Authorization', `Bearer ${token}`).send(payload)
			createdPost = body
			expect(status).toBe(201)
		})
	});
	function sleep (time) {
		return new Promise((resolve) => setTimeout(resolve, time));
	}
	describe('comment', () => {
		const commentParams = ['test', 'fads', 'd', 'asgas', '312312', 'her']
		each(commentParams).it('comment', async (comment) => {
			await sleep(500).then(async () => {
				const payload = { comment, postId: createdPost.id }
				const { body, status } = await request(app).post('/comment').set('Authorization', `Bearer ${token}`).send(payload)
				createdComments.push(body)
				expect(status).toBe(201)
			});
		})
		const bannedWords = ['banned', 'test2', 'random']
		each(bannedWords).it('comment filter', async (bannedWord) => {
			const payload = { comment: `ban${bannedWord}ned word`, postId: createdPost.id }
			const { body, status } = await request(app).post('/comment').set('Authorization', `Bearer ${token}`).send(payload)
			expect(status).toBe(304)
		})
		each([0,0,0,0,0]).it('filter spam comment', async () => {
			const payload = { comment: `ba33 word`, postId: createdPost.id }
			const { body, status } = await request(app).post('/comment').set('Authorization', `Bearer ${token}`).send(payload)
			expect(status).toBe(304)
		})
		it('update comment', async () => {
			const payload = { commentId: createdComments[0].id, comment: 'updatedComment' }
			const { body, status } = await request(app).patch('/comment').set('Authorization', `Bearer ${token}`).send(payload)
			expect(status).toBe(204)
		})
		const commentIdsToLike = [1,2,4,4,2,2,3,5,5]
		each(commentIdsToLike).it('like comment', async (commentId) => {
			const payload = {
				commentId: commentId,
				isLike: true
			}
			const { body, status } = await request(app).post(`/like`).set('Authorization', `Bearer ${token}`)
			.send(payload);
			expect(status).toBe(201);
		})
		const filterParams = ['latest', 'oldest', 'popular', ''
	]
		each(filterParams).it('get comments', async (filter) => {
			const postId = createdPost.id
			const { body, status } = await request(app).get(`/comments/${postId}/${filter}`).set('Authorization', `Bearer ${token}`)
			
			expect(status).toBe(200);
			
		})
		it('delete comment', async () => {
			const commentId = createdComments[0].id
			const { body, status } = await request(app).delete(`/comment/${commentId}`).set('Authorization', `Bearer ${token}`)
			expect(status).toBe(204)
		})
	})
})