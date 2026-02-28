import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Load SSL certificates for secure HTTPS/WSS context
  const httpsOptions = {
    key: fs.readFileSync(path.join(process.cwd(), 'certs', 'key.pem')),
    cert: fs.readFileSync(path.join(process.cwd(), 'certs', 'cert.pem')),
  };

  // Enable HTTPS in NestJS
  const app = await NestFactory.create(AppModule, { httpsOptions });

  // Enable CORS for the frontend running on a different port
  app.enableCors({
    origin: true, // Allow all origins in LAN environment
    credentials: true, // Required for secure context/WSS
  });

  // Listen on all network interfaces (0.0.0.0) for LAN access
  await app.listen(3000, '0.0.0.0');
  console.log(`🚀 BoxShare backend running on https://0.0.0.0:3000`);
  console.log(`📡 WebSocket signaling server is active`);
}

bootstrap();
