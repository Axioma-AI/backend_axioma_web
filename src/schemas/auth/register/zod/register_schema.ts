import { z } from "zod";

const UsernameRegex = /^[a-zA-Z0-9_.-]{3,20}$/;
const PhoneRegex = /^\d{6,15}$/;
const TwoFaTokenRegex = /^\d{6}$/;

export const RegisterRequestSchema = z
  .object({
    first_name: z.string().min(2, "Nombre inválido."),
    last_name_paternal: z.string().min(2, "Apellido inválido."),
    last_name_maternal: z.string().min(2).optional(),

    username: z.string().regex(UsernameRegex, "Username inválido (3-20, letras/números/._-)."),
    email: z.string().email("Email inválido."),
    phone: z.string().regex(PhoneRegex, "Phone number must be between 6 and 15 digits, without spaces or symbols."),
    country_code: z.string().min(1, "Country code inválido.").max(10, "Country code inválido."),

    password: z.string().min(8, "Password must be at least 8 characters long."),
    confirm_password: z.string().optional(),

    role_name: z.string().min(2).optional(),
    force_change_password: z
      .union([
        z.boolean(),
        z.string().transform((s) => ["true", "1", "yes", "on"].includes(s.trim().toLowerCase())),
      ])
      .optional(),

  })
  .refine((v) => !v.confirm_password || v.confirm_password === v.password, {
    message: "La confirmación de contraseña no coincide.",
    path: ["confirm_password"],
  });

export type RegisterRequestInput = z.infer<typeof RegisterRequestSchema>;
