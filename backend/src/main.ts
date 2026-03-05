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
  } else {
    console.error('❌ SSL Certificates not found in ./certs/');
    console.error('HTTPS is REQUIRED for screen sharing to work on other machines (Secure Context).');
    console.error('Please generate certs using: mkdir -p certs && openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj "/CN=localhost"');
    process.exit(1); // Force exit if HTTPS cannot be enabled
  }

  // FORCE HTTPS in NestJS
  const app = await NestFactory.create(AppModule, { httpsOptions });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Listen on all network interfaces (0.0.0.0) for LAN access
  await app.listen(3000, '0.0.0.0');

  console.log('--------------------------------------------------');
  console.log(`🚀 BoxShare backend SECUREly running on https://0.0.0.0:3000`);
  console.log(`📡 WebSocket signaling server is active over WSS`);
  console.log('--------------------------------------------------');
}

bootstrap();
