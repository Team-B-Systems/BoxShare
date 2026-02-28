import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for the frontend running on a different port
  app.enableCors({
    origin: true, // Allow all origins in LAN environment
    credentials: true,
  });

  // Listen on all network interfaces (0.0.0.0) for LAN access
  await app.listen(3000, '0.0.0.0');
  console.log(`🚀 BoxShare backend running on http://0.0.0.0:3000`);
  console.log(`📡 WebSocket signaling server is active`);
}

bootstrap();
