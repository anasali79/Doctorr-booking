export interface GeminiPart {
  text?: string;
  thoughtSignature?: string;
  functionCall?: {
    name: string;
    args: Record<string, any>;
    id?: string;
  };
  functionResponse?: {
    name: string;
    response: {
      name: string;
      content: any;
    };
  };
  [key: string]: any;
}

export interface GeminiContent {
  role: 'user' | 'model' | 'function' | 'tool' | string;
  parts: GeminiPart[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface GeminiGenerateRequest {
  contents: GeminiContent[];
  systemInstruction?: {
    parts: { text: string }[];
  };
  tools?: {
    functionDeclarations: GeminiFunctionDeclaration[];
  }[];
  toolConfig?: {
    functionCallingConfig?: {
      mode: 'AUTO' | 'ANY' | 'NONE';
      allowedFunctionNames?: string[];
    };
  };
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiGenerateResponse {
  candidates?: {
    content: {
      role: string;
      parts: GeminiPart[];
    };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

