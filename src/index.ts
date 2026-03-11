import 'reflect-metadata';
import express from 'express';
import cookieParser from 'cookie-parser';
import { setupLogger } from './utils/logger';
import { addCors } from './config/cors_config';
import { getAppSettings, type AppSettings, getSwaggerSettings, type SwaggerSettings } from './config/settings';
import { apiRouterV1 } from './routes/api/v1';
import { initDb } from './config/db_config';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { ensureDefaultRoles } from './services/auth/roles_seed';
import { errorMiddleware } from './middlewares/errorMiddleware';

const app = express();
const _APP_SETTINGS: AppSettings = getAppSettings();
const _SWAGGER_SETTINGS: SwaggerSettings = getSwaggerSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
addCors(app);

const authSwagger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = _SWAGGER_SETTINGS.swagger_user;
  const pass = _SWAGGER_SETTINGS.swagger_password;

  if (!user || !pass) {
    return res.status(500).send('Swagger docs authentication is not configured.');
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Swagger"');
    return res.status(401).send('Authentication required.');
  }

  const b64auth = authHeader.slice('Basic '.length).trim();
  if (b64auth.length === 0 || b64auth.length > 1024) {
    return res.status(400).send('Invalid authentication header.');
  }

  let login = '';
  let password = '';
  try {
    const decoded = Buffer.from(b64auth, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx === -1) {
      throw new Error('Invalid basic auth format');
    }
    login = decoded.slice(0, idx);
    password = decoded.slice(idx + 1);
  } catch {
    res.set('WWW-Authenticate', 'Basic realm="Swagger"');
    return res.status(401).send('Invalid authorization header.');
  }

  if (login === user && password === pass) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Swagger"');
  res.status(401).send('Invalid credentials.');
};

const docsSecurityHeaders = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
};

const DOCS_BASE_PATH = _APP_SETTINGS.docs_base_path;
app.use(DOCS_BASE_PATH, docsSecurityHeaders);

app.use(`${DOCS_BASE_PATH}/docs`, authSwagger, swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get(`${DOCS_BASE_PATH}/openapi.json`, authSwagger, (_req, res) => {
  res.json(swaggerSpec);
});

app.get(`${DOCS_BASE_PATH}/redoc`, authSwagger, (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${_APP_SETTINGS.service_name} - API Docs (Redoc)</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { margin: 0; padding: 0; }
      redoc { display: block; height: 100vh; }
    </style>
  </head>
  <body>
    <redoc spec-url="${DOCS_BASE_PATH}/openapi.json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>
  `);
});

app.use('/api/v1', apiRouterV1);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, data: null, message: 'Not found' });
});

app.use(errorMiddleware);

const { port } = _APP_SETTINGS;

initDb()
  .then(async () => {
    logger.info('DB initialized successfully.');
    await ensureDefaultRoles();
    app.listen(port, () => {
      logger.info(`Server running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    logger.error(`Failed to initialize DB: ${err?.message ?? err}`);
    app.listen(port, () => {
      logger.warn(`Server running without full DB on http://localhost:${port}`);
    });
  });
