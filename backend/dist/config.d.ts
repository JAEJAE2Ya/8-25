export type AppConfig = {
    nodeEnv: string;
    port: number;
    host: string;
    sessionSecret: string;
    sessionTtlDays: number;
    mfdsApiKey?: string;
    mfdsApiUrl: string;
    aiApiKey?: string;
    aiModel: string;
};
export declare function loadConfig(env?: NodeJS.ProcessEnv): AppConfig;
