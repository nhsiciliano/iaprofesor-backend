import fetch, { Headers, Request, Response } from 'node-fetch';
global.fetch = fetch as any;
global.Headers = Headers as any;
global.Request = Request as any;
global.Response = Response as any;

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('TutorController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let chatSessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up previous test data
    await prisma.user.deleteMany({ where: { email: 'testuser@example.com' } });

    // 1. Sign up a test user
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'testuser@example.com', password: 'password' });

    // 2. Log in to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'testuser@example.com', password: 'password' });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({ where: { email: 'testuser@example.com' } });
    await app.close();
  });

  it('/chats (POST) -> should create a new chat session', async () => {
    return request(app.getHttpServer())
      .post('/chats')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201)
      .then((response) => {
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('userId');
        chatSessionId = response.body.id; // Save for next tests
      });
  });

  it('/chats/:id/messages (POST) -> should add a message and get an AI response', async () => {
    const message = { content: 'Hello AI' };
    return request(app.getHttpServer())
      .post(`/chats/${chatSessionId}/messages`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(message)
      .expect(201)
      .then((response) => {
        expect(response.body).toHaveProperty('id');
        expect(response.body.content).toContain('placeholder response');
        expect(response.body.isUserMessage).toBe(false);
      });
  });

  it('/chats/:id/messages (GET) -> should get all messages for a session', async () => {
    return request(app.getHttpServer())
      .get(`/chats/${chatSessionId}/messages`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(2); // User message + AI response
        expect(response.body[0].content).toBe('Hello AI');
        expect(response.body[1].content).toContain('placeholder response');
      });
  });

  it('/chats/:id/messages (GET) -> should fail for unauthenticated user', () => {
    return request(app.getHttpServer())
      .get(`/chats/${chatSessionId}/messages`)
      .expect(401);
  });
});
