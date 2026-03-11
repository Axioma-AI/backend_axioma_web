import { S3Client } from '@aws-sdk/client-s3';
import { setupLogger } from '../utils/logger';
import { getAppSettings, getAwsSettings, type AppSettings, type AwsSettings } from './settings';

const _APP_SETTINGS: AppSettings = getAppSettings();
const _AWS_SETTINGS: AwsSettings = getAwsSettings();
const logger = setupLogger(_APP_SETTINGS.log_level, 'awsS3');

const s3 = new S3Client({
  region: _AWS_SETTINGS.default_region,
  credentials: {
    accessKeyId: _AWS_SETTINGS.access_key_id,
    secretAccessKey: _AWS_SETTINGS.secret_access_key,
  },
});

logger.info('S3Client configurado');

if (!_AWS_SETTINGS.default_region) {
    logger.warn('AWS_DEFAULT_REGION no está definido');
}

if (!_AWS_SETTINGS.access_key_id || !_AWS_SETTINGS.secret_access_key) {
    logger.error('Las credenciales de AWS no están definidas correctamente');
}

export default s3;
