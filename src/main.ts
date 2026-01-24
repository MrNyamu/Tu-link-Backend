import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TimestampConversionInterceptor } from './common/interceptors/timestamp-conversion.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.WS_CORS_ORIGIN || '*',
    credentials: true,
  });

  // Global exception filter for standardized error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptor to convert Firestore Timestamps to ISO 8601 strings
  // This MUST run before ResponseInterceptor
  app.useGlobalInterceptors(new TimestampConversionInterceptor());

  // Global response interceptor for standardized success responses
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation setup
  const config = new DocumentBuilder()
    .setTitle('Tu-Link Backend API')
    .setDescription(
      `Complete API for Tu-Link convoy coordination platform - enabling groups to travel together safely and efficiently.

## What is Tu-Link?
Tu-Link is a **convoy coordination platform** that helps groups of drivers travel together in real-time convoys. Perfect for:
- **Road Trips**: Coordinate family/friend group travel
- **Events**: Ensure groups arrive together at weddings, conferences, or gatherings
- **Commercial Fleets**: Manage delivery vehicles and service teams
- **Emergency Response**: Coordinate multiple response vehicles

## Core Features

### 🚗 **Real-Time Convoy Tracking**
- Live GPS tracking of all convoy participants
- Interactive maps showing driver positions with profile photos
- Speed and heading visualization
- Lag detection and alerts when drivers fall behind

### 📱 **Journey Management**
- Create and invite participants to journeys
- Role-based access (Leader/Follower permissions)
- Journey lifecycle: Planning → Active → Completed
- Flexible destination setting and route planning

### 🗺️ **Advanced Navigation**
- Mapbox-powered routing and navigation
- Optimized routes with real-time traffic data
- Turn-by-turn navigation with voice instructions
- Alternative route suggestions and optimization

### 🔔 **Smart Notifications**
- Push notifications for journey events
- Lag alerts when convoy members fall behind
- Arrival notifications and journey status updates
- Multi-device FCM token support

### 📊 **Journey Analytics**
- Post-journey performance analysis
- Distance, speed, and efficiency metrics
- Individual participant statistics
- Route optimization recommendations

## Authentication
All protected endpoints require a Bearer token:
\`\`\`
Authorization: Bearer <firebase-id-token>
\`\`\`

**Token Management:**
- **Register/Login**: Returns Firebase ID token (1 hour expiry)
- **Refresh**: Use refresh token to get new ID token
- **Phone Verification**: E.164 format required (+254722519316)

## Response Format
All responses follow Tu-Link's standardized format:

**Success Response:**
\`\`\`json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation completed successfully",
  "data": {
    // Actual response data here
  }
}
\`\`\`

**Error Response:**
\`\`\`json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": ["Specific error details array"]
  }
}
\`\`\`

## Date & Time Format
- **ISO 8601**: \`2026-01-24T10:30:00.000Z\` (UTC timestamps)
- **Duration**: \`HH:MM:SS\` format (e.g., "02:45:30")
- **Coordinates**: \`[longitude, latitude]\` order (GeoJSON standard)

## WebSocket Real-Time Features
**Connection URL**: \`ws://localhost:3000\` (Development)

**Key Events:**
- \`journey-update\`: Journey status changes
- \`location-update\`: Real-time participant locations
- \`participant-joined/left\`: Convoy membership changes
- \`lag-alert\`: Driver lagging notifications
- \`notification\`: Push notification delivery

**Authentication**: Include Firebase token in connection auth object

## Testing Guide
1. **Start Here**: Use Auth endpoints to register/login
2. **Create Journey**: Leader creates journey with destination
3. **Invite Participants**: Send invitations to other users
4. **Accept Invitations**: Participants accept to join convoy
5. **Start Journey**: Leader begins convoy coordination
6. **Location Updates**: Send GPS updates (WebSocket preferred, REST fallback)
7. **Real-Time Tracking**: Monitor convoy progress with Maps endpoints
8. **Journey Analytics**: Review performance after completion

All request bodies are pre-filled with realistic test data for easy API testing.
      `,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter Firebase ID token (from register/login endpoint)',
      },
      'bearer',
    )
    .addTag('auth', 'User authentication and profile management')
    .addTag('journeys', 'Convoy journey creation, management, and coordination')
    .addTag('locations', 'Real-time GPS tracking (WebSocket primary, REST fallback)')
    .addTag('notifications', 'Push notifications and FCM token management')
    .addTag('analytics', 'Journey performance analytics and user statistics')
    .addTag('maps', 'Mapbox integration: routing, navigation, and geocoding')
    .addServer('http://localhost:3000', 'Local Development')
    .addServer('https://api.dev.tulink.xyz', 'Development Environment')
    .addServer('https://api.staging.tulink.xyz', 'Staging Environment')
    .addServer('https://api.tulink.xyz', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
    🚗 Tu-Link Backend is running on: http://localhost:${port}
    📚 API Documentation: http://localhost:${port}/api/docs
    🔌 WebSocket Gateway: ws://localhost:${port}
    🌐 Base URL: https://tulink.xyz
  `);
}
bootstrap();
