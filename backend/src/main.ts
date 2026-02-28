import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const certPath = path.join(process.cwd(), 'certs', 'cert.pem');
  const keyPath = path.join(process.cwd(), 'certs', 'key.pem');

  let httpsOptions;
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }

  // Enable HTTPS in NestJS only if certificates are available
  const app = await NestFactory.create(AppModule, httpsOptions ? { httpsOptions } : undefined);

  // Enable CORS for the frontend running on a different port
  app.enableCors({
    origin: true, // Allow all origins in LAN environment
    credentials: true, // Required for secure context/WSS
  });

  // Listen on all network interfaces (0.0.0.0) for LAN access on port 3000
  await app.listen(3000, '0.0.0.0');
  console.log(`🚀 BoxShare backend running on ${httpsOptions ? 'https' : 'http'}://0.0.0.0:3000`);
  console.log(`📡 WebSocket signaling server is active`);
}

bootstrap();
