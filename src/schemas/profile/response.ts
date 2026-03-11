import type { ProfileUserDTO } from './dto/profile_user_dto';

export interface GetProfileResponse {
  user: ProfileUserDTO;
}

export interface UpdateProfileResponse {
  user: ProfileUserDTO;
}
