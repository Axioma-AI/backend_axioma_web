import { users } from "@prisma/client";

export type LoginUserEntity = users;

export type LoginInputDTO = {
  email?: string;
  username?: string;
  password: string;
  two_factor_token?: string;
  force_new_session?: boolean;
};
