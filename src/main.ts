import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Configurar CORS para permitir peticiones desde el frontend
  const corsOriginsConfig = configService.get<string>('CORS_ORIGINS');
  const corsOrigins = corsOriginsConfig
    ? corsOriginsConfig.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [
        'http://localhost:3000', // Frontend en desarrollo
        'https://localhost:3000', // Frontend HTTPS en desarrollo
      ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('IA Profesor API')
    .setDescription('API documentation for the IA Profesor backend service')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Usar puerto 3002 por defecto para alinearse con el frontend
  const port = configService.get<number>('PORT') ?? 3002;
  await app.listen(port);
  logger.log(`Servidor ejecutandose en http://localhost:${port}`);
  logger.log(`Documentacion Swagger disponible en http://localhost:${port}/api`);
}
bootstrap();
