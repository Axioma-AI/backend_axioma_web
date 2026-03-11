import s3 from "../../config/awsS3_config";
import { GetObjectCommand, PutObjectCommand, PutObjectCommandInput, PutObjectCommandOutput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isBase64, isDataURI } from "class-validator";
import { ValidationError } from "../../utils/errors";
import { getAppSettings, getAwsSettings, type AppSettings, type AwsSettings } from "../../config/settings";
const mime = require('mime-kind');
import { setupLogger } from '../../utils/logger';

const _APP_SETTINGS: AppSettings = getAppSettings();
const _AWS_SETTINGS: AwsSettings = getAwsSettings();
const logger = setupLogger(_APP_SETTINGS.log_level, 's3Repository');

logger.info('Cargando repositorio S3Repository');

function buildKey(p: string): string {
    const prefix = (_AWS_SETTINGS.root_prefix || '').replace(/^\/+|\/+$/g, '');
    const key = (p || '').replace(/^\/+/, '');
    if (!prefix) return key;
    if (key.toLowerCase().startsWith(prefix.toLowerCase() + '/')) return key;
    return `${prefix}/${key}`;
}

export const uploadFile = async (path: string, fileB64OrDataURI: string): Promise<any> => {
    logger.info('Iniciando subida de archivo a S3: ' + path);

    if (!_AWS_SETTINGS.bucket_name) {
        throw new ValidationError("AWS bucket name is not configured.", 500);
    }

    const isValidDataURI = isDataURI(fileB64OrDataURI);
    const isValidBase64 = isBase64(fileB64OrDataURI);
    let params: PutObjectCommandInput;

    if (isValidDataURI) {
        const match = /^data:([^;]+);base64,(.+)$/i.exec(fileB64OrDataURI);
        if (match && match[1] && match[2]) {
            const mimeType = match[1];
            const base64String = match[2];
            const buffer = Buffer.from(base64String, 'base64');
            params = {
                Bucket: _AWS_SETTINGS.bucket_name,
                Key: buildKey(path),
                Body: buffer,
                ContentType: mimeType,
                ContentLength: buffer.length,
            };
            logger.info('Data URI válida extraída correctamente ' + path);
        } else {
            logger.error('No se pudo decodificar el Data URI ' + path);
            throw new ValidationError("Unable to decode Data URI", 400);
        }
    } else if (isValidBase64) {
        const buffer = Buffer.from(fileB64OrDataURI, 'base64');
        const fileType = await mime(buffer);
        params = {
            Bucket: _AWS_SETTINGS.bucket_name,
            Key: buildKey(path),
            Body: buffer,
            ContentType: fileType?.mime,
            ContentLength: buffer.length,
        };
        if (!fileType?.mime) {
            logger.error('No se pudo detectar el tipo MIME de la cadena base64 ' + path);
            throw new ValidationError("Unable to detect mime type of base64 string", 400);
        }
        logger.info('Base64 válido extraído correctamente + ' + path);
    } else {
        logger.error('Formato de archivo no válido ' + path);
        throw new ValidationError("Invalid file format. Must be either base64 or data URI.", 400);
    }

    try {
        const data: PutObjectCommandOutput = await s3.send(new PutObjectCommand(params));
        logger.info('Archivo subido correctamente a S3 ' + path);
        return { location: buildKey(path), ...data };
    } catch (error: any) {
        logger.error('Error al subir el archivo a S3 ' + path + ' ' + (error?.message ?? error));
        throw error;
    }
};

export const getSignedUrlByPath = async (path: string): Promise<string> => {
    logger.info('Generando URL firmada para el archivo ' + path);

    if (!_AWS_SETTINGS.bucket_name) {
        throw new ValidationError("AWS bucket name is not configured.", 500);
    }

    const params = {
        Bucket: _AWS_SETTINGS.bucket_name,
        Key: buildKey(path)
    };
    const expirationTime = 3600;
    try {
        const url = await getSignedUrl(s3, new GetObjectCommand(params), { expiresIn: expirationTime });
        logger.info('URL firmada generada correctamente para el archivo ' + path + ' con url ' + url);
        return url;
    } catch (error: any) {
        logger.error('Error al generar la URL firmada para el archivo ' + path + ' ' + (error?.message ?? error));
        throw error;
    }
};
