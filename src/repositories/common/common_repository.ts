export interface CommonRepository {
    parseDBError(error: unknown): Error;
}
