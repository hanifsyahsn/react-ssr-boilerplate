export interface User {
    id: string;
    email: string;
    name: string;
}

export type UserAttributes = Omit<User, "id">;

export interface JsonApiResource<TAttributes> {
    type: string;
    id: string;
    attributes: TAttributes;
}

export interface JsonApiDataResponse<TAttributes> {
    data: JsonApiResource<TAttributes>;
}

export interface JsonApiErrorObject {
    status: string;
    title: string;
    detail?: string;
}

export interface JsonApiErrorResponse {
    errors: JsonApiErrorObject[];
}
