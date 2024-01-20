export type CardanoNetwork = 'mainnet' | 'testnet' | 'preview' | 'preprod';
export type BlockfrostNetwork = CardanoNetwork | 'ipfs';

export interface RateLimiterConfig {
    size: number;
    increaseInterval: number;
    increaseAmount: number;
}

export declare type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'HEAD' | 'DELETE' | 'OPTIONS' | 'TRACE' | 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete' | 'options' | 'trace';

export interface RetryObject {
    attemptCount: number;
    retryOptions: RequiredRetryOptions;
    error: Error;
    computedValue: number;
    retryAfter?: number;
}
export declare type RetryFunction = (retryObject: RetryObject) => number | Promise<number>;

export interface RequiredRetryOptions {
    limit: number;
    methods: Method[];
    statusCodes: number[];
    errorCodes: string[];
    calculateDelay: RetryFunction;
    maxRetryAfter?: number;
}

type OptionCombination1 = {
    projectId: string;
    customBackend?: string;
};
type OptionCombination2 = {
    projectId?: string;
    customBackend: string;
};
type AdditionalOptions = {
    network?: CardanoNetwork;
    version?: number;
    rateLimiter?: boolean | RateLimiterConfig;
    http2?: boolean;
    debug?: boolean;
    userAgent?: string;
    requestTimeout?: number;
    retrySettings?: RequiredRetryOptions;
};
export type BlockfrostOptions = OptionCombination1;