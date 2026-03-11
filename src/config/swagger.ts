import swaggerJSDoc, { OAS3Definition, OAS3Options } from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import { getAppSettings, type AppSettings } from './settings';
import { RoleName } from '../schemas/roles';

const appSettings: AppSettings = getAppSettings();

const swaggerDefinition: OAS3Definition = {
  openapi: '3.0.0',
  info: {
    title: appSettings.service_name,
    version: appSettings.version,
    description: `OpenAPI documentation for ${appSettings.service_name}`,
  },
  servers: [
    ...(appSettings.api_base_url && !/^http:\/\/localhost\b/.test(appSettings.api_base_url)
      ? [{ url: appSettings.api_base_url, description: 'Production server' }]
      : []),
    { url: `http://localhost:${appSettings.port}`, description: 'Local server' },
  ],
  tags: [
    { name: 'Admin', description: 'Admin endpoints (role admin only)' },
    { name: 'Admin Interests', description: 'Interests & groups management (Admin)' },
    { name: 'User Interests', description: 'Interests & groups endpoints (Profile)' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Profile', description: 'User profile endpoints' },
    { name: 'Two Factor Authentication', description: '2FA endpoints' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Personal API Key (sent in X-API-Key header)'
      },
    },
    schemas: {
      BaseResponseLogin: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/LoginResponse' },
          message: { type: 'string', example: 'Login successful' },
        },
      },
      BaseResponseForgotPassword: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true }
            }
          },
          message: { type: 'string', example: 'Password updated successfully' },
        },
      },
      BaseResponseLogout: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/LogoutResponse' },
          message: { type: 'string', example: 'Logout successful' },
        },
      },
      BaseResponseRegister: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/RegisterResponse' },
          message: { type: 'string', example: 'User created' },
        },
      },
      BaseResponseDeleteUser: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/DeleteUserResponse' },
          message: { type: 'string', example: 'User deleted' },
        },
      },
      TwoFactorSetupResponse: {
        type: 'object',
        required: ['secret', 'qr_code_url', 'manual_entry_key', 'issuer', 'label', 'expires_at'],
        properties: {
          secret: { type: 'string', description: 'Base32 secret for manual configuration' },
          qr_code_url: { type: 'string', description: 'otpauth:// URL to generate QR code' },
          manual_entry_key: { type: 'string', description: 'Key for manual entry (same as secret)' },
          issuer: { type: 'string', description: 'Name of the configured issuer' },
          label: { type: 'string', description: 'Configured label' },
          expires_at: { type: 'string', format: 'date-time', description: 'Configuration expiration datetime' },
        },
        example: {
          secret: 'JBSWY3DPEHPK3PXP',
          qr_code_url: 'otpauth://totp/My%20App:john@example.com?secret=JBSWY3DPEHPK3PXP&issuer=My%20App',
          manual_entry_key: 'JBSWY3DPEHPK3PXP',
          issuer: 'My App',
          label: 'john@example.com',
          expires_at: '2024-01-15T10:30:00.000Z',
        },
      },
      BaseResponseTwoFactorSetup: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/TwoFactorSetupResponse' },
          message: { type: 'string', example: 'Two-factor setup generated' },
        },
      },
      TwoFactorVerifyResponse: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: { type: 'boolean', description: 'Indicates whether verification was successful' },
          message: { type: 'string', description: 'Descriptive message of the result' },
          user_id: { type: 'integer', nullable: true, description: 'Authenticated user ID' },
          role_id: { type: 'integer', nullable: true, description: 'User role ID' },
          recovery_codes: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of 10 recovery codes in plain text',
          },
          access_token: { type: 'string', description: 'Access token after 2FA completed' },
        },
        examples: {
          success: {
            summary: 'Verification successful',
            value: {
              success: true,
              message: '2FA enabled successfully.',
              user_id: 1,
              role_id: 2,
              recovery_codes: ['ABCD-EFGH-IJKL', 'MNOP-QRST-UVWX'],
              access_token: '<JWT>',
            },
          },
          failure: {
            summary: 'Invalid code',
            value: {
              success: false,
              message: 'Invalid verification code.',
            },
          },
        },
      },
      BaseResponseTwoFactorVerify: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/TwoFactorVerifyResponse' },
          message: { type: 'string', example: 'Two-factor verification processed' },
        },
      },
      TwoFactorStatusResponse: {
        type: 'object',
        required: ['is_enabled', 'confirmed_at', 'issuer', 'label'],
        properties: {
          is_enabled: { type: 'boolean', description: 'Indicates whether 2FA is enabled' },
          confirmed_at: { type: 'string', format: 'date-time', nullable: true, description: 'Confirmation date and time' },
          issuer: { type: 'string', nullable: true, description: 'Configured issuer name' },
          label: { type: 'string', nullable: true, description: 'Configured label' },
        },
        examples: {
          enabled: {
            summary: '2FA enabled',
            value: {
              is_enabled: true,
              confirmed_at: '2024-01-15T10:30:00.000Z',
              issuer: 'My Application',
              label: 'john@example.com',
            },
          },
          disabled: {
            summary: '2FA not configured',
            value: {
              is_enabled: false,
              confirmed_at: null,
              issuer: null,
              label: null,
            },
          },
        },
      },
      BaseResponseTwoFactorStatus: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/TwoFactorStatusResponse' },
          message: { type: 'string', example: 'Two-factor status fetched' },
        },
      },
      BaseResponsePersonalTokenCreate: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              token: { type: 'string', example: 'ptkn_9f8a7b6c5d4e3f2a1b0c' },
            },
          },
          message: { type: 'string', example: 'Personal token created' },
        },
        example: {
          success: true,
          data: { token: 'ptkn_9f8a7b6c5d4e3f2a1b0c' },
          message: 'Personal token created',
        },
      },
      BaseResponsePersonalTokenList: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/PersonalTokenListItem' },
          },
          message: { type: 'string', example: 'Personal tokens fetched' },
        },
        example: {
          success: true,
          data: [
            {
              id: 1,
              name: 'CI pipeline token',
              created_at: '2024-01-01T10:00:00.000Z',
              expires_at: '2024-04-01T10:00:00.000Z',
            },
            {
              id: 2,
              name: null,
              created_at: '2025-10-28T21:59:47.000Z',
              expires_at: '2026-01-28T21:59:47.000Z',
            },
          ],
          message: 'Personal tokens fetched',
        },
      },
      BaseResponsePersonalTokenRevoke: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              revoked: { type: 'boolean', example: true },
            },
          },
          message: { type: 'string', example: 'Personal token revoked' },
        },
        example: {
          success: true,
          data: { revoked: true },
          message: 'Personal token revoked',
        },
      },
      BaseErrorResponse: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: false },
          data: { type: 'string', nullable: true, example: null },
          message: { type: 'string', example: 'Invalid credentials.' },
        },
      },
      BaseResponseAdminUsersList: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            required: ['users', 'page', 'size', 'total'],
            properties: {
              users: {
                type: 'array',
                items: { $ref: '#/components/schemas/AdminListUser' },
              },
              page: { type: 'integer', example: 1 },
              size: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 42 },
            },
          },
          message: { type: 'string', example: 'Users fetched' },
        },
        example: {
          success: true,
          data: {
            users: [
              { id: 1, name: 'Jane', lastname: 'Admin Smith', username: 'janeadmin', email: 'admin@example.com', phone: '65656565', country_code: 'MX', role: { id: 5, name: 'admin' }, seats_quota: 10 },
              { id: 2, name: 'John', lastname: 'Doe', username: 'johndoe2', email: 'john2@example.com', phone: '5551234567', country_code: 'US', role: { id: 4, name: 'member' }, seats_quota: 5 },
            ],
            page: 1,
            size: 20,
            total: 2,
          },
          message: 'Users fetched',
        },
      },
      PublicUser: {
        type: 'object',
        required: ['id', 'name', 'lastname', 'username', 'email', 'role'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          lastname: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', nullable: true, description: 'Optional phone number (6-15 digits)' },
          role: {
            type: 'object',
            properties: {
              id: { type: 'integer', nullable: true },
              name: { type: 'string', nullable: true, enum: Object.values(RoleName) },
            },
          },
        },
      },
      AdminListUser: {
        type: 'object',
        required: ['id', 'name', 'lastname', 'username', 'email', 'role', 'seats_quota'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          lastname: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', nullable: true, description: 'Optional phone number (6-15 digits)' },
          country_code: { type: 'string', nullable: true, description: 'Country code, e.g., MX, US, PE' },
          role: {
            type: 'object',
            properties: {
              id: { type: 'integer', nullable: true },
              name: { type: 'string', nullable: true, enum: Object.values(RoleName) },
            },
          },
          seats_quota: { type: 'integer', description: 'Seats asignados al usuario por el admin', example: 5 },
        },
      },
      LoginResponse: {
        type: 'object',
        required: ['user_id', 'role_id', 'access_token'],
        properties: {
          user_id: { type: 'integer', description: 'Authenticated user ID' },
          role_id: { type: 'integer', nullable: true, description: 'Role ID or null if not applicable' },
          access_token: {
            type: 'string',
            description: 'Access JWT. Use in Authorization: Bearer <token>. Includes jti and exp.',
          },
          requires_password_change: {
            type: 'boolean',
            nullable: true,
            description: 'Indicates the user must change password before accessing other endpoints',
          },
          requires_two_factor: {
            type: 'boolean',
            nullable: true,
            description: 'Indicates the user must complete 2FA verification',
          },
        },
      },
      LogoutResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean', description: 'true if the request was processed. If token is valid, session is revoked.' },
        },
      },
      RegisterResponse: {
        type: 'object',
        required: ['user'],
        properties: {
          user: { $ref: '#/components/schemas/PublicUser' },
        },
        example: {
          user: {
            id: 7,
            name: 'John',
            lastname: 'Doe',
            username: 'johndoe2',
            email: 'john2@example.com',
            phone: '65656565',
            role: { id: 4, name: 'member' },
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: [
          'first_name',
          'last_name_paternal',
          'username',
          'email',
          'phone',
          'country_code',
          'password'
        ],
        properties: {
          first_name: { type: 'string', minLength: 2, description: 'User first name (minimum 2 characters)', default: 'Jane' },
          last_name_paternal: { type: 'string', minLength: 2, description: 'User paternal last name (minimum 2 characters)', default: 'Admin' },
          last_name_maternal: { type: 'string', minLength: 2, description: 'User maternal last name (minimum 2 characters)', default: 'Smith' },
          username: { type: 'string', description: '3-20 characters; letters, numbers, . _ -', default: 'janeadmin' },
          email: { type: 'string', format: 'email', description: 'Valid email address', default: 'admin@example.com' },
          phone: { type: 'string', description: '6-15 digits, no spaces or symbols', default: '65656565' },
          country_code: {
            type: 'string',
            description: 'Phone country code (e.g. 52)',
            default: '591',
          },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Minimum 8; must include uppercase, lowercase, number and symbol; no sequential digits',
            default: 'MyPassw0rd!',
          },
          confirm_password: {
            type: 'string',
            description: 'Must match password',
            default: 'MyPassw0rd!',
          },
          role_name: { type: 'string', nullable: true, enum: Object.values(RoleName), description: 'Optional; role name to assign', default: 'member' },
          force_change_password: { type: 'boolean', nullable: true, description: 'Force password change on first login', default: false },
        },
        description: 'Admin-managed registration. Allows assigning role.',
      },
      RegisterRootRequest: {
        type: 'object',
        required: [
          'first_name',
          'last_name_paternal',
          'username',
          'email',
          'phone',
          'country_code',
          'password'
        ],
        properties: {
          first_name: { type: 'string', minLength: 2, description: 'User first name (minimum 2 characters)', default: 'Jane' },
          last_name_paternal: { type: 'string', minLength: 2, description: 'User paternal last name (minimum 2 characters)', default: 'Admin' },
          last_name_maternal: { type: 'string', minLength: 2, description: 'User maternal last name (minimum 2 characters)', default: 'Smith' },
          username: { type: 'string', description: '3-20 characters; letters, numbers, . _ -', default: 'janeadmin' },
          email: { type: 'string', format: 'email', description: 'Valid email address', default: 'admin@example.com' },
          phone: { type: 'string', description: '6-15 digits, no spaces or symbols', default: '65656565' },
          country_code: {
            type: 'string',
            description: 'Phone country code (e.g. 52)',
            default: '591',
          },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Minimum 8; must include uppercase, lowercase, number and symbol; no sequential digits',
            default: 'MyPassw0rd!',
          },
          confirm_password: {
            type: 'string',
            description: 'Must match password',
            default: 'MyPassw0rd!',
          },
        },
        description: 'Initial Admin user registration.',
      },
      LoginRequest: {
        oneOf: [
          {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { type: 'string', format: 'email', description: 'User email. Alternatively, send username.' },
              password: { type: 'string', minLength: 8, description: 'User password (minimum 8 characters)' },
              two_factor_token: { 
                type: 'string', 
                pattern: '^\\d{6}$',
                description: 'Optional 2FA token (6 digits). Required if 2FA is enabled for the user.' 
              },
            },
          },
          {
            type: 'object',
            required: ['username', 'password'],
            properties: {
              username: { type: 'string', description: 'Username (3-20, letters/numbers/._-)' },
              password: { type: 'string', minLength: 8, description: 'User password (minimum 8 characters)' },
              two_factor_token: { 
                type: 'string', 
                pattern: '^\\d{6}$',
                description: 'Optional 2FA token (6 digits). Required if 2FA is enabled for the user.' 
              },
            },
          },
        ],
        description: 'Provide email or username along with password. Include two_factor_token if 2FA is enabled for the user.',
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Client-readable error message' },
        },
      },
      Profile: {
        type: 'object',
        required: ['id', 'name', 'lastname', 'username', 'email', 'role'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          lastname: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', nullable: true },
          country_code: { type: 'string', nullable: true, description: 'Phone country code (e.g. 52)' },
          avatar_url: { type: 'string', nullable: true, description: "URL to fetch the user's avatar (signed S3 URL)" },
          role: {
            type: 'object',
            properties: {
              id: { type: 'integer', nullable: true },
              name: { type: 'string', nullable: true, enum: Object.values(RoleName) },
            },
          },
        },
      },
      GetProfileResponse: {
        type: 'object',
        required: ['user'],
        properties: {
          user: { $ref: '#/components/schemas/Profile' },
        },
      },
      BaseResponseGetProfile: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/GetProfileResponse' },
          message: { type: 'string', example: 'Profile fetched successfully' },
        },
      },
      UpdateProfileRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, description: 'Optional; User first name (minimum 2 characters)' },
          lastname: { type: 'string', minLength: 2, description: 'Optional; User paternal last name (minimum 2 characters)'},
          username: { type: 'string', description: '3-20 characters; letters, numbers, . _ -' },
          phone: { type: 'string', nullable: true, description: 'Optional; 6-15 digits, no spaces or symbols' },
          country_code: { type: 'string', nullable: true, description: 'Optional; phone country code (e.g. 52)' },
          avatar: { 
            type: 'string', 
            format: 'binary', 
            description: 'Avatar image file (multipart only). Type is auto-detected; rejects non-jpg/jpeg/png/heic/heif.' 
          },
        },
        description: 'Allows partial profile updates. Use multipart/form-data to upload the avatar.',
      },
      UpdateProfileResponse: {
        type: 'object',
        required: ['user'],
        properties: {
          user: { $ref: '#/components/schemas/Profile' },
        },
      },
      BaseResponseUpdateProfile: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/UpdateProfileResponse' },
          message: { type: 'string', example: 'Profile updated successfully' },
        },
      },
      ProfilePasswordUpdateRequest: {
        type: 'object',
        required: ['current_password', 'new_password'],
        properties: {
          current_password: { type: 'string', description: 'User current password', example: 'OldPassw0rd!' },
          new_password: { type: 'string', description: 'New secure password', example: 'NewPassw0rd!1' },
        },
        description: 'Body to update the profile password',
      },
      BaseResponseProfilePassword: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
            },
          },
          message: { type: 'string', example: 'Password updated successfully' },
        },
      },
      PersonalTokenExpiryPreset: {
        type: 'string',
        enum: ['1_week', '1_month', '3_months', '6_months', '1_year'],
        description: 'Expiration preset for personal tokens (recommended default: 3 months)'
      },
      PersonalTokenCreateRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Optional label for the token' },
          expires_preset: {
            $ref: '#/components/schemas/PersonalTokenExpiryPreset'
          },
        },
        description: 'Body for personal token creation (JSON or multipart)'
      },
      PersonalTokenCreateResponse: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Personal token in plain text (only shown once)' },
        },
      },
      PersonalTokenListItem: {
        type: 'object',
        required: ['id', 'created_at', 'expires_at'],
        properties: {
          id: { type: 'number', description: 'Token identifier' },
          name: { type: 'string', nullable: true, description: 'Optional token label' },
          created_at: { type: 'string', format: 'date-time', description: 'Creation date (ISO string)' },
          expires_at: { type: 'string', format: 'date-time', description: 'Expiration date (ISO string)' },
        },
        example: {
          id: 1,
          name: 'CI pipeline token',
          created_at: '2024-01-01T10:00:00.000Z',
          expires_at: '2024-04-01T10:00:00.000Z',
        },
      },
      DeleteUserRequest: {
        type: 'object',
        deprecated: true,
        description: 'Not used: DELETE /auth/users/{id} does not accept a body.',
      },
      DeleteUserResponse: {
        type: 'object',
        required: ['success', 'id'],
        properties: {
          success: { type: 'boolean', example: true },
          id: { type: 'integer', example: 12 },
        },
      },
      InterestItem: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
      InterestGroup: {
        type: 'object',
        required: ['id', 'name', 'interests'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          interests: {
            type: 'array',
            items: { $ref: '#/components/schemas/InterestItem' },
          },
        },
      },
      SummaryUser: {
        type: 'object',
        required: ['id', 'email', 'username'],
        properties: {
          id: { type: 'integer' },
          email: { type: 'string', format: 'email' },
          username: { type: 'string' },
          name: { type: 'string', nullable: true, description: 'Nombre' },
          lastname: { type: 'string', nullable: true, description: 'Apellidos (paterno y materno concatenados)' },
          phone: { type: 'string', nullable: true, description: 'Teléfono (6-15 dígitos)' },
          country_code: { type: 'string', nullable: true, description: 'Código de país (ej. MX, US, PE)' },
        },
      },
      InterestsSummaryResponse: {
        type: 'object',
        required: ['user', 'seats_quota', 'seats_used', 'seats_remaining', 'interests', 'groups'],
        properties: {
          user: { $ref: '#/components/schemas/SummaryUser' },
          seats_quota: { type: 'integer', example: 5 },
          seats_used: { type: 'integer', example: 3 },
          seats_remaining: { type: 'integer', example: 2 },
          interests: {
            type: 'array',
            description: 'Interests sin grupo (no asignados a ningún grupo)',
            items: { $ref: '#/components/schemas/InterestItem' },
          },
          groups: {
            type: 'array',
            items: { $ref: '#/components/schemas/InterestGroup' },
          },
        },
      },
      BaseResponseAdminUsersSummary: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/InterestsSummaryResponse' },
          message: { type: 'string', example: 'Resumen de usuario' },
        },
      },
      AdminInterestCreateResponse: {
        type: 'object',
        required: ['user_id', 'interest_id', 'name'],
        properties: {
          user_id: { type: 'integer' },
          interest_id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
      BaseResponseAdminInterestCreate: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/AdminInterestCreateResponse' },
          message: { type: 'string', example: 'Interest creado' },
        },
      },
      AdminInterestGroupCreateResponse: {
        type: 'object',
        required: ['user_id', 'group_id', 'name', 'interests'],
        properties: {
          user_id: { type: 'integer' },
          group_id: { type: 'integer' },
          name: { type: 'string' },
          interests: {
            type: 'array',
            items: { $ref: '#/components/schemas/InterestItem' },
          },
        },
      },
      BaseResponseAdminInterestGroupCreate: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/AdminInterestGroupCreateResponse' },
          message: { type: 'string', example: 'Grupo creado' },
        },
      },
      AdminInterestGroupAddItemResponse: {
        type: 'object',
        required: ['group_id', 'interest_id'],
        properties: {
          group_id: { type: 'integer' },
          interest_id: { type: 'integer' },
          already: { type: 'boolean', nullable: true },
        },
      },
      BaseResponseAdminInterestGroupAddItem: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/AdminInterestGroupAddItemResponse' },
          message: { type: 'string', example: 'Interest añadido al grupo' },
        },
      },
      InterestsCreateResponse: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
      BaseResponseInterestsCreate: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/InterestsCreateResponse' },
          message: { type: 'string', example: 'Interest creado' },
        },
      },
      InterestsGroupCreateResponse: {
        type: 'object',
        required: ['group_id', 'name', 'interests'],
        properties: {
          group_id: { type: 'integer' },
          name: { type: 'string' },
          interests: {
            type: 'array',
            items: { $ref: '#/components/schemas/InterestItem' },
          },
        },
      },
      BaseResponseInterestsGroupCreate: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/InterestsGroupCreateResponse' },
          message: { type: 'string', example: 'Grupo creado' },
        },
      },
      InterestsGroupAddItemResponse: {
        type: 'object',
        required: ['group_id', 'interest_id'],
        properties: {
          group_id: { type: 'integer' },
          interest_id: { type: 'integer' },
          already: { type: 'boolean', nullable: true },
        },
      },
      BaseResponseInterestsGroupAddItem: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/InterestsGroupAddItemResponse' },
          message: { type: 'string', example: 'Interest añadido al grupo' },
        },
      },
    },
  },
  security: [
    { bearerAuth: [] },
    { apiKeyAuth: [] },
  ],
  paths: {
    '/api/v1/admin/users': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete user (ADMIN only)',
        description: 'Deletes a user by id OR email OR username. Requires explicit confirmation.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'id',
            required: false,
            description: 'User ID to delete',
            schema: { type: 'integer', minimum: 1 },
          },
          {
            in: 'query',
            name: 'email',
            required: false,
            description: 'User email to delete',
            schema: { type: 'string', format: 'email' },
          },
          {
            in: 'query',
            name: 'username',
            required: false,
            description: 'User username to delete',
            schema: { type: 'string' },
          },
          {
            in: 'query',
            name: 'confirm',
            required: true,
            description: 'Explicit confirmation to delete',
            schema: { type: 'boolean', default: false },
          },
        ],
        responses: {
          '200': {
            description: 'User deleted',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/BaseResponseDeleteUser' } },
            },
          },
          '400': { description: 'Invalid identifier or missing confirmation', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '403': { description: 'Restricted access: requires admin role', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '404': { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/admin/users/summary': {
      get: {
        tags: ['Admin'],
        summary: 'User summary (ADMIN only)',
        description: 'Fetch user seats, interests and groups by id OR email OR username. Restricted to users created by the admin.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'id',
            required: false,
            description: 'User ID',
            schema: { type: 'integer', minimum: 1 },
          },
          {
            in: 'query',
            name: 'email',
            required: false,
            description: 'User email',
            schema: { type: 'string', format: 'email' },
          },
          {
            in: 'query',
            name: 'username',
            required: false,
            description: 'User username',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'User summary fetched',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/BaseResponseAdminUsersSummary' } },
            },
          },
          '400': { description: 'Invalid identifier', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '403': { description: 'Restricted access: requires admin and ownership of the user', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '404': { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/admin/users/seats': {
      get: {
        tags: ['Admin'],
        summary: 'Admin seats summary (pool 20)',
        description: 'Shows total pool, assigned to users, admin user seats and remaining.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Admin seats summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        admin_pool_total: { type: 'integer', example: 20 },
                        admin_pool_assigned_to_users: { type: 'integer', example: 15 },
                        admin_user_seats_quota: { type: 'integer', example: 3 },
                        admin_user_seats_used: { type: 'integer', example: 2 },
                        admin_overall_remaining: { type: 'integer', example: 2 },
                        admin_user_seats_remaining: { type: 'integer', example: 1 },
                      },
                    },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Assign seats to a user (ADMIN)',
        description: 'Sets seats_quota for a target user created by the admin or for the admin themselves. The total pool (users + admin) cannot exceed 20.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'id', required: false, schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'email', required: false, schema: { type: 'string', format: 'email' } },
          { in: 'query', name: 'username', required: false, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['seats'],
                properties: { seats: { type: 'integer', minimum: 0, maximum: 20 } },
              },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['seats'],
                properties: { seats: { type: 'integer', minimum: 0, maximum: 20 } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Seats assigned', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseResponseDeleteUser' } } } },
          '400': { description: 'Invalid data or pool exceeds 20', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '403': { description: 'Restricted access (target must be created by admin unless target is admin)', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '404': { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/admin/interests/groups/{groupId}': {
      delete: {
        tags: ['Admin Interests'],
        summary: 'Delete interest group (ADMIN only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'groupId', required: true, schema: { type: 'integer', minimum: 1 } },
        ],
        responses: {
          '200': {
            description: 'Group deleted',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseResponseDeleteUser' } } },
          },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '403': { description: 'Restricted access', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '404': { description: 'Group not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/admin/interests': {
      post: {
        tags: ['Admin Interests'],
        summary: 'Create interest for a user (ADMIN)',
        description: 'Creates an interest for a user created by the admin. Respects user seats_quota.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'id', required: false, schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'email', required: false, schema: { type: 'string', format: 'email' } },
          { in: 'query', name: 'username', required: false, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string' } },
              },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Interest created', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseResponseAdminInterestCreate' } } } },
          '400': { description: 'Invalid data or no seats available', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '403': { description: 'Restricted access', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '404': { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/admin/interests/groups': {
      post: {
        tags: ['Admin Interests'],
        summary: 'Create interest group for a user (ADMIN)',
        description: 'Creates a group for a user created by the admin. May include interest_names; missing ones are created if seats are available.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'id', required: false, schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'email', required: false, schema: { type: 'string', format: 'email' } },
          { in: 'query', name: 'username', required: false, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  interest_names: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  interest_names: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Group created', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseResponseAdminInterestGroupCreate' } } } },
          '400': { description: 'Invalid data or insufficient seats', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '403': { description: 'Restricted access', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '404': { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/admin/interests/groups/{groupId}/items': {
      post: {
        tags: ['Admin Interests'],
        summary: 'Add existing or new interest to a user group (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'groupId', required: true, schema: { type: 'integer', minimum: 1 } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  interest_id: { type: 'integer' },
                  interest_name: { type: 'string' },
                },
              },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  interest_id: { type: 'integer' },
                  interest_name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Interest added to group', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseResponseAdminInterestGroupAddItem' } } } },
          '400': { description: 'Invalid data or no seats available', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '403': { description: 'Restricted access', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '404': { description: 'Group or interest not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/admin/interests/{interestId}': {
      delete: {
        tags: ['Admin Interests'],
        summary: 'Delete user interest (ADMIN only)',
        description: 'Validates groups keep ≥ 2 interests before deletion',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'interestId', required: true, schema: { type: 'integer', minimum: 1 } },
        ],
        responses: {
          '200': {
            description: 'Interest deleted',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseResponseDeleteUser' } } },
          },
          '400': { description: 'Group ≥ 2 rule violated', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '403': { description: 'Restricted access', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '404': { description: 'Interest not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/interests/{interestId}': {
      delete: {
        tags: ['User Interests'],
        summary: 'Delete interest (User)',
        description: 'Validates groups keep ≥ 2 interests before deletion',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'interestId', required: true, schema: { type: 'integer', minimum: 1 } },
        ],
        responses: {
          '200': {
            description: 'Interest deleted',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseResponseDeleteUser' } } },
          },
          '400': { description: 'Group ≥ 2 rule violated', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '404': { description: 'Interest not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/interests': {
      post: {
        tags: ['User Interests'],
        summary: 'Create interest (User)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string' } },
              },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Interest created', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseResponseInterestsCreate' } } } },
          '400': { description: 'Invalid data', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/interests/groups': {
      post: {
        tags: ['User Interests'],
        summary: 'Create interest group (User)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  interest_names: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  interest_names: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Group created', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseResponseInterestsGroupCreate' } } } },
          '400': { description: 'Invalid data', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
    '/api/v1/interests/groups/{groupId}/items': {
      post: {
        tags: ['User Interests'],
        summary: 'Add interest to group (User)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'groupId', required: true, schema: { type: 'integer', minimum: 1 } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  interest_id: { type: 'integer' },
                  interest_name: { type: 'string' },
                },
              },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  interest_id: { type: 'integer' },
                  interest_name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Interest added to group', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseResponseInterestsGroupAddItem' } } } },
          '400': { description: 'Invalid data', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
          '404': { description: 'Group or interest not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
        },
      },
    },
  },
};

const distRoutesDir = path.join(process.cwd(), 'dist', 'routes');
const distSchemasDir = path.join(process.cwd(), 'dist', 'schemas');
const srcRoutesDir = path.join(process.cwd(), 'src', 'routes');
const srcSchemasDir = path.join(process.cwd(), 'src', 'schemas');
const useDistEnv = (process.env.SWAGGER_USE_DIST || 'false').toLowerCase() === 'true';
const hasDist = fs.existsSync(distRoutesDir) && fs.existsSync(distSchemasDir);
const hasSrc = fs.existsSync(srcRoutesDir) && fs.existsSync(srcSchemasDir);
const useDist = useDistEnv || (!hasSrc && hasDist);

const options: OAS3Options = {
  definition: swaggerDefinition,
  apis: useDist
    ? [
        'dist/routes/**/*.js',
        'dist/schemas/**/*.js',
      ]
    : [
        'src/routes/**/*.ts',
        'src/schemas/**/*.ts',
      ],
};

export const swaggerSpec = swaggerJSDoc(options);
