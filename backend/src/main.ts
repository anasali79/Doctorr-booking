import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter — consistent JSON error responses, no server crashes
  app.useGlobalFilters(new GlobalExceptionFilter());

  const rawClientUrl = process.env.CLIENT_URL || '';
  const configuredOrigins = rawClientUrl
    ? rawClientUrl.split(',').map((o) => o.trim().replace(/\/+$/, ''))
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Next.js server-side fetches)
      if (!origin) return callback(null, true);

      const normalized = origin.trim().replace(/\/+$/, '');

      // Allow localhost, 127.0.0.1, any *.vercel.app domain (previews & production), or configured CLIENT_URL
      if (
        configuredOrigins.includes(normalized) ||
        normalized.endsWith('.vercel.app') ||
        normalized.includes('localhost') ||
        normalized.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }

      // Default allow valid browser origins in production so CORS never breaks
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Set-Cookie'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`CareUp Backend running on port ${port}`);
  console.log(`API base URL: /api`);
  console.log(
    `Auth routes:        /api/auth/signup  |  /api/auth/login  |  /api/auth/logout`,
  );
  console.log(
    `Doctor routes:      /api/doctor  |  /api/doctor/:id  |  /api/doctor/profile`,
  );
  console.log(`Patient routes:     /api/patient/profile`);
}
bootstrap();
