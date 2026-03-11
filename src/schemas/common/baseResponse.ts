export const HTTP = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
};

export class BaseResponse<T> {
    public readonly success: boolean;
    public readonly data: T | null;
    public readonly message: string;

    constructor(data: T | null = null, message: string = 'Operation successfully completed') {
        this.success = true;
        this.data = data;
        this.message = message;
    }
}
