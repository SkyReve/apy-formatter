import * as vscode from "vscode";

// -------------------- Schema Types --------------------

export type MemberKind = "method" | "property" | "class";

export type MemberDefinition = {
  name: string;
  kind: MemberKind;
  pythonSignature: string; // Python type signature for stub file
  completionDetail?: string; // Detail shown in completion (defaults to pythonSignature)
};

export type ClassDefinition = {
  name: string;
  bases?: string;
  isProtocol?: boolean;
  members: readonly MemberDefinition[];
  nestedClasses?: readonly ClassDefinition[];
  initParams?: readonly string[];
};

export type VariableDefinition = {
  name: string;
  typeName: string;
};

// -------------------- APY Runtime Schema --------------------

const LOGGER_MEMBERS: MemberDefinition[] = [
  {
    name: "debug",
    kind: "method",
    pythonSignature:
      "def debug(self, message: str, *args: Any, **kwargs: Any) -> None: ...",
  },
  {
    name: "info",
    kind: "method",
    pythonSignature:
      "def info(self, message: str, *args: Any, **kwargs: Any) -> None: ...",
  },
  {
    name: "warning",
    kind: "method",
    pythonSignature:
      "def warning(self, message: str, *args: Any, **kwargs: Any) -> None: ...",
  },
  {
    name: "error",
    kind: "method",
    pythonSignature:
      "def error(self, message: str, *args: Any, **kwargs: Any) -> None: ...",
  },
  {
    name: "critical",
    kind: "method",
    pythonSignature:
      "def critical(self, message: str, *args: Any, **kwargs: Any) -> None: ...",
  },
  {
    name: "exception",
    kind: "method",
    pythonSignature:
      "def exception(self, message: str, *args: Any, **kwargs: Any) -> None: ...",
  },
];

// HTTP Exception classes from reve/services/sdk/exceptions.py
// These are accessed via 'exceptions.Http400', 'exceptions.Http403', etc.
const EXCEPTIONS_NESTED_CLASSES: ClassDefinition[] = [
  {
    name: "HttpException",
    bases: "Exception",
    members: [
      {
        name: "status_code",
        kind: "property",
        pythonSignature: "status_code: int",
      },
      {
        name: "data",
        kind: "property",
        pythonSignature: "data: Optional[dict]",
      },
    ],
  },
  { name: "Http400", bases: "HttpException", members: [] },
  { name: "Http401", bases: "HttpException", members: [] },
  { name: "Http403", bases: "HttpException", members: [] },
  { name: "Http404", bases: "HttpException", members: [] },
  { name: "Http409", bases: "HttpException", members: [] },
  { name: "Http410", bases: "HttpException", members: [] },
  { name: "Http500", bases: "HttpException", members: [] },
];

// HTTP Exception classes - direct access (also available via exceptions.Http*)
const HTTP_EXCEPTION_CLASSES: ClassDefinition[] = [
  {
    name: "Http400",
    bases: "Exception",
    members: [
      { name: "status_code", kind: "property", pythonSignature: "status_code: int" },
      { name: "data", kind: "property", pythonSignature: "data: Optional[dict]" },
    ],
    initParams: ["data: Optional[dict] = None"],
  },
  {
    name: "Http401",
    bases: "Exception",
    members: [
      { name: "status_code", kind: "property", pythonSignature: "status_code: int" },
      { name: "data", kind: "property", pythonSignature: "data: Optional[dict]" },
    ],
    initParams: ["data: Optional[dict] = None"],
  },
  {
    name: "Http403",
    bases: "Exception",
    members: [
      { name: "status_code", kind: "property", pythonSignature: "status_code: int" },
      { name: "data", kind: "property", pythonSignature: "data: Optional[dict]" },
    ],
    initParams: ["data: Optional[dict] = None"],
  },
  {
    name: "Http404",
    bases: "Exception",
    members: [
      { name: "status_code", kind: "property", pythonSignature: "status_code: int" },
      { name: "data", kind: "property", pythonSignature: "data: Optional[dict]" },
    ],
    initParams: ["data: Optional[dict] = None"],
  },
  {
    name: "Http409",
    bases: "Exception",
    members: [
      { name: "status_code", kind: "property", pythonSignature: "status_code: int" },
      { name: "data", kind: "property", pythonSignature: "data: Optional[dict]" },
    ],
    initParams: ["data: Optional[dict] = None"],
  },
  {
    name: "Http410",
    bases: "Exception",
    members: [
      { name: "status_code", kind: "property", pythonSignature: "status_code: int" },
      { name: "data", kind: "property", pythonSignature: "data: Optional[dict]" },
    ],
    initParams: ["data: Optional[dict] = None"],
  },
  {
    name: "Http500",
    bases: "Exception",
    members: [
      { name: "status_code", kind: "property", pythonSignature: "status_code: int" },
      { name: "data", kind: "property", pythonSignature: "data: Optional[dict]" },
    ],
    initParams: ["data: Optional[dict] = None"],
  },
];

// JWT Token classes from reve/services/sdk/jwt.py
const ACCESS_TOKEN_MEMBERS: MemberDefinition[] = [
  { name: "user_id", kind: "property", pythonSignature: "user_id: Any" },
  { name: "exp", kind: "property", pythonSignature: "exp: Optional[int]" },
  { name: "iat", kind: "property", pythonSignature: "iat: Optional[int]" },
  { name: "encode", kind: "method", pythonSignature: "def encode(self) -> str: ..." },
];

const REFRESH_TOKEN_MEMBERS: MemberDefinition[] = [
  { name: "user_id", kind: "property", pythonSignature: "user_id: Any" },
  { name: "exp", kind: "property", pythonSignature: "exp: Optional[int]" },
  { name: "iat", kind: "property", pythonSignature: "iat: Optional[int]" },
  { name: "encode", kind: "method", pythonSignature: "def encode(self) -> str: ..." },
];

// Response class from reve/services/sdk/response.py
const RESPONSE_MEMBERS: MemberDefinition[] = [
  {
    name: "status_code",
    kind: "property",
    pythonSignature: "status_code: int",
  },
  {
    name: "content_type",
    kind: "property",
    pythonSignature: "content_type: str",
  },
  {
    name: "data",
    kind: "property",
    pythonSignature: "data: Union[dict, None, Any]",
  },
  {
    name: "add_data",
    kind: "method",
    pythonSignature: "def add_data(self, key: str, value: Any) -> None: ...",
  },
  {
    name: "set_cookie",
    kind: "method",
    pythonSignature:
      "def set_cookie(self, key: str, value: str = ..., max_age: Optional[int] = ..., expires: Optional[str] = ..., path: str = ..., domain: Optional[str] = ..., httponly: bool = ...) -> None: ...",
  },
  {
    name: "delete_cookie",
    kind: "method",
    pythonSignature:
      "def delete_cookie(self, key: str, path: str = ..., domain: Optional[str] = ..., samesite: Optional[str] = ...) -> None: ...",
  },
];

// Request class from reve/services/sdk/request.py
const REQUEST_MEMBERS: MemberDefinition[] = [
  { name: "method", kind: "property", pythonSignature: "method: str" },
  { name: "path", kind: "property", pythonSignature: "path: str" },
  {
    name: "headers",
    kind: "property",
    pythonSignature: "headers: Dict[str, Any]",
  },
  { name: "data", kind: "property", pythonSignature: "data: Dict[str, Any]" },
  {
    name: "path_params",
    kind: "property",
    pythonSignature: "path_params: Dict[str, Any]",
  },
  {
    name: "query_params",
    kind: "property",
    pythonSignature: "query_params: Dict[str, Any]",
  },
  {
    name: "cookies",
    kind: "property",
    pythonSignature: "cookies: Dict[str, Any]",
  },
  { name: "meta", kind: "property", pythonSignature: "meta: Dict[str, Any]" },
  { name: "files", kind: "property", pythonSignature: "files: Any" },
  { name: "user", kind: "property", pythonSignature: "user: Optional[Any]" },
  {
    name: "absolute_url",
    kind: "property",
    pythonSignature: "absolute_url: Optional[str]",
  },
];

// Auth class from reve/services/sdk/auth.py
const AUTH_MEMBERS: MemberDefinition[] = [
  {
    name: "encode_password",
    kind: "method",
    pythonSignature:
      "def encode_password(self, password: str, validators: Optional[list] = None) -> str: ...",
  },
  {
    name: "check_password",
    kind: "method",
    pythonSignature:
      "def check_password(self, password: str, hashed_password: str) -> bool: ...",
  },
  {
    name: "generate_otp_value",
    kind: "method",
    pythonSignature:
      "def generate_otp_value(self, length: int = 6, *, use_number: bool = True, use_letter: bool = True) -> str: ...",
  },
  {
    name: "is_auth_enabled",
    kind: "method",
    pythonSignature: "def is_auth_enabled(self) -> bool: ...",
  },
  {
    name: "is_auth_jwt_enabled",
    kind: "method",
    pythonSignature: "def is_auth_jwt_enabled(self) -> bool: ...",
  },
  {
    name: "is_auth_jwt_cookie_enabled",
    kind: "method",
    pythonSignature: "def is_auth_jwt_cookie_enabled(self) -> bool: ...",
  },
  {
    name: "is_auth_username_enabled",
    kind: "method",
    pythonSignature: "def is_auth_username_enabled(self) -> bool: ...",
  },
  {
    name: "is_auth_email_enabled",
    kind: "method",
    pythonSignature: "def is_auth_email_enabled(self) -> bool: ...",
  },
  {
    name: "is_auth_mobile_enabled",
    kind: "method",
    pythonSignature: "def is_auth_mobile_enabled(self) -> bool: ...",
  },
  {
    name: "is_auth_social_github_enabled",
    kind: "method",
    pythonSignature: "def is_auth_social_github_enabled(self) -> bool: ...",
  },
  {
    name: "is_auth_social_google_enabled",
    kind: "method",
    pythonSignature: "def is_auth_social_google_enabled(self) -> bool: ...",
  },
  {
    name: "encode_jwt_refresh",
    kind: "method",
    pythonSignature:
      "def encode_jwt_refresh(self, user: Any, **kwargs: Any) -> Any: ...",
  },
  {
    name: "encode_jwt_access",
    kind: "method",
    pythonSignature:
      "def encode_jwt_access(self, refresh: Any, **kwargs: Any) -> Any: ...",
  },
  {
    name: "decode_jwt_refresh",
    kind: "method",
    pythonSignature: "def decode_jwt_refresh(self, token_str: str) -> Any: ...",
  },
  {
    name: "decode_jwt_access",
    kind: "method",
    pythonSignature: "def decode_jwt_access(self, token_str: str) -> Any: ...",
  },
  {
    name: "send_email",
    kind: "method",
    pythonSignature:
      "def send_email(self, subject: str, recipient: str, from_email: str, *, body: Optional[str] = None, content_subtype: str = 'plain', template_id: Optional[str] = None, dynamic_data: Optional[dict] = None) -> None: ...",
  },
  {
    name: "generate_github_auth_url",
    kind: "method",
    pythonSignature:
      "def generate_github_auth_url(self, *, redirect_url: str, state: Optional[str] = None) -> str: ...",
  },
  {
    name: "fetch_github_access_token",
    kind: "method",
    pythonSignature:
      "def fetch_github_access_token(self, code: str) -> dict: ...",
  },
  {
    name: "fetch_github_authenticated_user",
    kind: "method",
    pythonSignature:
      "def fetch_github_authenticated_user(self, access_token: str) -> dict: ...",
  },
  {
    name: "generate_google_auth_url",
    kind: "method",
    pythonSignature:
      "def generate_google_auth_url(self, *, redirect_url: str, state: Optional[str] = None) -> str: ...",
  },
  {
    name: "fetch_google_access_token",
    kind: "method",
    pythonSignature:
      "def fetch_google_access_token(self, code: str, redirect_url: str) -> dict: ...",
  },
  {
    name: "fetch_google_authenticated_user",
    kind: "method",
    pythonSignature:
      "def fetch_google_authenticated_user(self, access_token: str) -> dict: ...",
  },
  {
    name: "social_authenticate",
    kind: "method",
    pythonSignature:
      "def social_authenticate(self, provider: str, code: str, redirect_url: Optional[str] = None) -> tuple: ...",
  },
  {
    name: "password_validators",
    kind: "property",
    pythonSignature: "password_validators: Any",
  },
];

// Database class from reve/services/sdk/database.py
const DATABASE_MEMBERS: MemberDefinition[] = [
  {
    name: "get",
    kind: "method",
    pythonSignature: "def get(self, table_name: str) -> Optional[_Table]: ...",
  },
  {
    name: "expressions",
    kind: "property",
    pythonSignature: "expressions: _Expressions",
  },
  {
    name: "exceptions",
    kind: "property",
    pythonSignature: "exceptions: _SQLExceptions",
  },
];

// Table class from reve/services/sdk/database.py (ReveSDKTable)
const TABLE_MEMBERS: MemberDefinition[] = [
  {
    name: "insert",
    kind: "method",
    pythonSignature: "def insert(self, **kwargs: Any) -> Any: ...",
  },
  {
    name: "select",
    kind: "method",
    pythonSignature: "def select(self) -> Any: ...",
  },
  {
    name: "select_for_update",
    kind: "method",
    pythonSignature:
      "def select_for_update(self, nowait: bool = False, skip_locked: bool = False, of: tuple = (), no_key: bool = False) -> Any: ...",
  },
  {
    name: "update_or_insert",
    kind: "method",
    pythonSignature:
      "def update_or_insert(self, defaults: Optional[dict] = None, create_defaults: Optional[dict] = None, **kwargs: Any) -> Any: ...",
  },
  {
    name: "DoesNotExist",
    kind: "property",
    pythonSignature: "DoesNotExist: type",
  },
];

// Expressions class from reve/services/sdk/database.py (ReveSDKExpressions)
const EXPRESSIONS_MEMBERS: MemberDefinition[] = [
  { name: "Q", kind: "property", pythonSignature: "Q: type" },
  { name: "F", kind: "property", pythonSignature: "F: type" },
  { name: "Func", kind: "property", pythonSignature: "Func: type" },
  { name: "Value", kind: "property", pythonSignature: "Value: type" },
  { name: "OuterRef", kind: "property", pythonSignature: "OuterRef: type" },
  { name: "Subquery", kind: "property", pythonSignature: "Subquery: type" },
  { name: "Avg", kind: "property", pythonSignature: "Avg: type" },
  { name: "Count", kind: "property", pythonSignature: "Count: type" },
  { name: "Min", kind: "property", pythonSignature: "Min: type" },
  { name: "Max", kind: "property", pythonSignature: "Max: type" },
  { name: "Sum", kind: "property", pythonSignature: "Sum: type" },
  { name: "Coalesce", kind: "property", pythonSignature: "Coalesce: type" },
  { name: "Concat", kind: "property", pythonSignature: "Concat: type" },
  { name: "Now", kind: "property", pythonSignature: "Now: type" },
  { name: "Lower", kind: "property", pythonSignature: "Lower: type" },
  { name: "Upper", kind: "property", pythonSignature: "Upper: type" },
];

// SQL Exceptions class from reve/services/sdk/database.py (ReveSDKSQLExceptions)
const SQL_EXCEPTIONS_MEMBERS: MemberDefinition[] = [
  {
    name: "ObjectDoesNotExist",
    kind: "property",
    pythonSignature: "ObjectDoesNotExist: type",
  },
  {
    name: "IntegrityError",
    kind: "property",
    pythonSignature: "IntegrityError: type",
  },
];

// Utils class from reve/services/sdk/utils.py
const UTILS_MEMBERS: MemberDefinition[] = [
  {
    name: "encode_password",
    kind: "method",
    pythonSignature:
      "def encode_password(self, password: str, validators: Optional[list] = None, hasher: str = 'default') -> str: ...",
  },
  {
    name: "check_password",
    kind: "method",
    pythonSignature:
      "def check_password(self, password: str, encoded_password: str) -> bool: ...",
  },
  {
    name: "encrypt_aes256_cbc",
    kind: "method",
    pythonSignature:
      "def encrypt_aes256_cbc(self, plaintext: str, key: bytes, iv: bytes, encoding: str = 'utf-8') -> bytes: ...",
  },
  {
    name: "encrypt_aes256_ecb",
    kind: "method",
    pythonSignature:
      "def encrypt_aes256_ecb(self, plaintext: str, key: bytes, encoding: str = 'utf-8') -> bytes: ...",
  },
  {
    name: "decrypt_aes256_cbc",
    kind: "method",
    pythonSignature:
      "def decrypt_aes256_cbc(self, ciphertext: bytes, key: bytes, iv: bytes, encoding: str = 'utf-8') -> str: ...",
  },
  {
    name: "decrypt_aes256_ecb",
    kind: "method",
    pythonSignature:
      "def decrypt_aes256_ecb(self, ciphertext: bytes, key: bytes, encoding: str = 'utf-8') -> str: ...",
  },
  {
    name: "encode_sha256_base64",
    kind: "method",
    pythonSignature: "def encode_sha256_base64(self, text: str) -> str: ...",
  },
  {
    name: "generate_random_string",
    kind: "method",
    pythonSignature:
      "def generate_random_string(self, min_length: int = 8, max_length: int = 16, *, use_number: bool = False, use_letter: bool = True, use_punctuation: bool = False, case_sensitive: bool = False) -> str: ...",
  },
  {
    name: "has_letter_in_string",
    kind: "method",
    pythonSignature: "def has_letter_in_string(self, string: str) -> bool: ...",
  },
  {
    name: "has_digit_in_string",
    kind: "method",
    pythonSignature: "def has_digit_in_string(self, string: str) -> bool: ...",
  },
  {
    name: "has_punctuation_in_string",
    kind: "method",
    pythonSignature:
      "def has_punctuation_in_string(self, string: str) -> bool: ...",
  },
  {
    name: "to_datetime_tz",
    kind: "method",
    pythonSignature:
      "def to_datetime_tz(self, value: str, format: str = '%Y-%m-%d %H:%M:%S.%f', from_tz: str = 'Asia/Seoul', to_tz: str = 'UTC') -> Optional[datetime]: ...",
  },
  {
    name: "to_datetime",
    kind: "method",
    pythonSignature:
      "def to_datetime(self, text: str, format: Optional[str] = None) -> datetime: ...",
  },
  {
    name: "now",
    kind: "method",
    pythonSignature: "def now(self) -> datetime: ...",
  },
  {
    name: "substring",
    kind: "method",
    pythonSignature:
      "def substring(self, seq: str, start: Optional[int], end: Optional[int] = None) -> str: ...",
  },
  { name: "DIGITS", kind: "property", pythonSignature: "DIGITS: str" },
  {
    name: "PUNCTUATION",
    kind: "property",
    pythonSignature: "PUNCTUATION: str",
  },
  {
    name: "ASCII_LOWER",
    kind: "property",
    pythonSignature: "ASCII_LOWER: str",
  },
  {
    name: "ASCII_UPPER",
    kind: "property",
    pythonSignature: "ASCII_UPPER: str",
  },
  { name: "LETTER", kind: "property", pythonSignature: "LETTER: str" },
];

// Libs class from reve/services/sdk/external_libs.py
const LIBS_MEMBERS: MemberDefinition[] = [
  { name: "requests", kind: "property", pythonSignature: "requests: Any" },
  { name: "urllib", kind: "property", pythonSignature: "urllib: Any" },
  { name: "base64", kind: "property", pythonSignature: "base64: Any" },
  { name: "typing", kind: "property", pythonSignature: "typing: Any" },
  { name: "zoneinfo", kind: "property", pythonSignature: "zoneinfo: Any" },
  { name: "datetime", kind: "property", pythonSignature: "datetime: Any" },
  { name: "re", kind: "property", pythonSignature: "re: Any" },
  { name: "math", kind: "property", pythonSignature: "math: Any" },
  { name: "json", kind: "property", pythonSignature: "json: Any" },
  { name: "hashlib", kind: "property", pythonSignature: "hashlib: Any" },
  { name: "paginator", kind: "property", pythonSignature: "paginator: Any" },
  { name: "jwt", kind: "property", pythonSignature: "jwt: Any" },
  { name: "google", kind: "property", pythonSignature: "google: Any" },
];

// AI class from reve/services/sdk/ai.py
const AI_MEMBERS: MemberDefinition[] = [
  {
    name: "chat",
    kind: "method",
    pythonSignature:
      "def chat(self, message: str, *, model_name: Optional[str] = None, system_prompt: Optional[str] = None, output_schema: Optional[dict] = None, history: Optional[list] = None, temperature: Optional[float] = None, max_retries: Optional[int] = None, max_tokens: Optional[int] = None, timeout: Optional[int] = None) -> Union[str, dict]: ...",
  },
  {
    name: "create_text_collection",
    kind: "method",
    pythonSignature:
      "def create_text_collection(self, collection_name: str, *, use_bm25: bool = False, recreate: bool = False) -> None: ...",
  },
  {
    name: "create_image_collection",
    kind: "method",
    pythonSignature:
      "def create_image_collection(self, collection_name: str, *, recreate: bool = False) -> None: ...",
  },
  {
    name: "embed_query",
    kind: "method",
    pythonSignature: "def embed_query(self, query: str) -> list: ...",
  },
  {
    name: "embed_texts",
    kind: "method",
    pythonSignature: "def embed_texts(self, texts: list) -> list: ...",
  },
  {
    name: "embed_images",
    kind: "method",
    pythonSignature: "def embed_images(self, images: list) -> list: ...",
  },
  {
    name: "index_texts",
    kind: "method",
    pythonSignature:
      "def index_texts(self, texts: list, *, collection_name: str, payloads: list, ids: Optional[list] = None) -> None: ...",
  },
  {
    name: "index_images",
    kind: "method",
    pythonSignature:
      "def index_images(self, images: list, *, collection_name: str, payloads: list, ids: Optional[list] = None) -> None: ...",
  },
  {
    name: "search_texts",
    kind: "method",
    pythonSignature:
      "def search_texts(self, query: str, *, collection_name: str, top_k: int = 3, with_payload: bool = True, with_vectors: bool = False, score_threshold: Optional[float] = None) -> list: ...",
  },
  {
    name: "search_texts_in_memory",
    kind: "method",
    pythonSignature:
      "def search_texts_in_memory(self, query: str, *, texts: list, payloads: Optional[list] = None, top_k: int = 3) -> list: ...",
  },
  {
    name: "search_images",
    kind: "method",
    pythonSignature:
      "def search_images(self, image: Any, *, collection_name: str, top_k: int = 3, with_payload: bool = True, with_vectors: bool = False, score_threshold: Optional[float] = None) -> list: ...",
  },
];

// Reve class from reve/services/sdk/sdk.py
const REVE_MEMBERS: MemberDefinition[] = [
  { name: "request", kind: "property", pythonSignature: "request: _Request" },
  { name: "user", kind: "property", pythonSignature: "user: Optional[Any]" },
  { name: "auth", kind: "property", pythonSignature: "auth: _Auth" },
  {
    name: "database",
    kind: "property",
    pythonSignature: "database: _Database",
  },
  { name: "libs", kind: "property", pythonSignature: "libs: _Libs" },
  {
    name: "system",
    kind: "property",
    pythonSignature: "system: Dict[str, Any]",
  },
  {
    name: "system_settings",
    kind: "property",
    pythonSignature: "system_settings: Dict[str, Any]",
  },
  {
    name: "settings",
    kind: "property",
    pythonSignature: "settings: Dict[str, Any]",
  },
  {
    name: "secrets",
    kind: "property",
    pythonSignature: "secrets: Dict[str, Any]",
  },
  {
    name: "secret_settings",
    kind: "property",
    pythonSignature: "secret_settings: Dict[str, Any]",
  },
  { name: "utils", kind: "property", pythonSignature: "utils: _Utils" },
  { name: "ai", kind: "property", pythonSignature: "ai: _AI" },
  { name: "env", kind: "property", pythonSignature: "env: Dict[str, Any]" },
  {
    name: "backend_root_url",
    kind: "property",
    pythonSignature: "backend_root_url: str",
  },
  {
    name: "set_user",
    kind: "method",
    pythonSignature: "def set_user(self, user: Any) -> None: ...",
  },
  {
    name: "auth_signup",
    kind: "method",
    pythonSignature:
      "def auth_signup(self, *, password: str, confirm_password: str, **kwargs: Any) -> Response: ...",
  },
  {
    name: "auth_login",
    kind: "method",
    pythonSignature:
      "def auth_login(self, *, password: str, **kwargs: Any) -> Response: ...",
  },
  {
    name: "auth_logout",
    kind: "method",
    pythonSignature: "def auth_logout(self) -> Response: ...",
  },
  {
    name: "auth_refresh",
    kind: "method",
    pythonSignature: "def auth_refresh(self, refresh: str) -> Response: ...",
  },
  {
    name: "auth_signout",
    kind: "method",
    pythonSignature: "def auth_signout(self) -> Response: ...",
  },
  {
    name: "change_password",
    kind: "method",
    pythonSignature:
      "def change_password(self, *, old_password: str, new_password: str, confirm_password: str, **kwargs: Any) -> Response: ...",
  },
  {
    name: "send_email",
    kind: "method",
    pythonSignature:
      "def send_email(self, subject: str, message: str, recipient: str) -> None: ...",
  },
];

const APY_RUNTIME_SCHEMA: {
  imports: readonly string[];
  classes: readonly ClassDefinition[];
  variables: readonly VariableDefinition[];
} = {
  imports: [
    "from __future__ import annotations",
    "from datetime import datetime",
    "from typing import Any, Dict, Optional, Protocol, Union",
  ],
  classes: [
    // exceptions namespace with HTTP exception classes
    {
      name: "exceptions",
      members: [],
      nestedClasses: EXCEPTIONS_NESTED_CLASSES,
    },
    // Logger protocol
    {
      name: "_Logger",
      isProtocol: true,
      members: LOGGER_MEMBERS,
    },
    // Request class
    {
      name: "_Request",
      isProtocol: true,
      members: REQUEST_MEMBERS,
    },
    // Auth class
    {
      name: "_Auth",
      isProtocol: true,
      members: AUTH_MEMBERS,
    },
    // Database class
    {
      name: "_Database",
      isProtocol: true,
      members: DATABASE_MEMBERS,
    },
    // Table class (accessed via reve.database["table_name"])
    {
      name: "_Table",
      isProtocol: true,
      members: TABLE_MEMBERS,
    },
    // Expressions class (accessed via reve.database.expressions)
    {
      name: "_Expressions",
      isProtocol: true,
      members: EXPRESSIONS_MEMBERS,
    },
    // SQL Exceptions class (accessed via reve.database.exceptions)
    {
      name: "_SQLExceptions",
      isProtocol: true,
      members: SQL_EXCEPTIONS_MEMBERS,
    },
    // Utils class
    {
      name: "_Utils",
      isProtocol: true,
      members: UTILS_MEMBERS,
    },
    // Libs class
    {
      name: "_Libs",
      isProtocol: true,
      members: LIBS_MEMBERS,
    },
    // AI class
    {
      name: "_AI",
      isProtocol: true,
      members: AI_MEMBERS,
    },
    // Response class
    {
      name: "Response",
      members: RESPONSE_MEMBERS,
      initParams: [
        "status_code: int = 200",
        "data: Union[dict, str, None] = None",
        "content_type: str = 'application/json'",
      ],
    },
    // Reve class
    {
      name: "Reve",
      isProtocol: true,
      members: REVE_MEMBERS,
    },
    // HTTP Exception classes (direct access)
    ...HTTP_EXCEPTION_CLASSES,
    // JWT Token classes
    {
      name: "AccessToken",
      members: ACCESS_TOKEN_MEMBERS,
      initParams: ["user_id: Any", "**kwargs: Any"],
    },
    {
      name: "RefreshToken",
      members: REFRESH_TOKEN_MEMBERS,
      initParams: ["user_id: Any", "**kwargs: Any"],
    },
  ],
  variables: [{ name: "logger", typeName: "_Logger" }],
};

// -------------------- Generate Stub File --------------------

export function generateApyRuntimeStub(): string {
  const lines: string[] = [];

  // Imports
  for (const importLine of APY_RUNTIME_SCHEMA.imports) {
    lines.push(importLine);
  }
  lines.push("");

  // Classes
  for (const classDef of APY_RUNTIME_SCHEMA.classes) {
    let baseClause = "";
    if (classDef.isProtocol) {
      baseClause = "(Protocol)";
    } else if ("bases" in classDef && classDef.bases) {
      baseClause = `(${classDef.bases})`;
    }
    lines.push(`class ${classDef.name}${baseClause}:`);

    // Nested classes (for exceptions)
    if ("nestedClasses" in classDef && classDef.nestedClasses) {
      for (const nested of classDef.nestedClasses) {
        const nestedBase = nested.bases ? `(${nested.bases})` : "";
        lines.push(`    class ${nested.name}${nestedBase}: ...`);
      }
    }

    // Members
    for (const member of classDef.members) {
      if (member.kind === "property") {
        lines.push(`    ${member.pythonSignature}`);
      } else if (member.kind === "method") {
        lines.push(`    ${member.pythonSignature}`);
      }
    }

    // __init__ for classes with initParams
    if ("initParams" in classDef && classDef.initParams) {
      lines.push("");
      lines.push("    def __init__(");
      lines.push("        self,");
      for (const param of classDef.initParams) {
        lines.push(`        ${param},`);
      }
      lines.push("    ) -> None: ...");
    }

    // Empty class body needs pass
    const hasNestedClasses = "nestedClasses" in classDef && classDef.nestedClasses && classDef.nestedClasses.length > 0;
    const hasMembers = classDef.members.length > 0;
    const hasInit = "initParams" in classDef && classDef.initParams;
    if (!hasNestedClasses && !hasMembers && !hasInit) {
      lines.push("    ...");
    }

    lines.push("");
  }

  // Variables
  for (const variable of APY_RUNTIME_SCHEMA.variables) {
    lines.push(`${variable.name}: ${variable.typeName}`);
    lines.push("");
  }

  return lines.join("\n");
}

// -------------------- Generate Completions --------------------

function getCompletionKind(memberKind: MemberKind): vscode.CompletionItemKind {
  switch (memberKind) {
    case "method":
      return vscode.CompletionItemKind.Method;
    case "property":
      return vscode.CompletionItemKind.Property;
    case "class":
      return vscode.CompletionItemKind.Class;
  }
}

function extractCompletionDetail(member: MemberDefinition): string {
  if (member.completionDetail) return member.completionDetail;

  // Extract detail from pythonSignature
  const sig = member.pythonSignature;
  if (member.kind === "method") {
    // "def name(self, ...) -> ReturnType: ..." -> "name(...) -> ReturnType"
    const match = sig.match(
      /def\s+(\w+)\s*\((self,?\s*)?(.*?)\)\s*(->\s*[^:]+)?/,
    );
    if (match) {
      const name = match[1];
      const params = match[3] || "";
      const returnType = match[4] ? match[4].trim() : "";
      return `${name}(${params})${returnType}`;
    }
  } else if (member.kind === "property") {
    // "name: Type" -> "Type"
    const match = sig.match(/\w+:\s*(.+)/);
    if (match) return match[1];
  }
  return sig;
}

// Map internal class names to their access patterns for completions
const CLASS_TO_COMPLETION_KEY: Record<string, string> = {
  _Logger: "logger",
  _Request: "reve.request",
  _Auth: "reve.auth",
  _Database: "reve.database",
  _Table: "reve.database[]",
  _Expressions: "reve.database.expressions",
  _SQLExceptions: "reve.database.exceptions",
  _Utils: "reve.utils",
  _Libs: "reve.libs",
  _AI: "reve.ai",
  Reve: "reve",
};

function generateApyRuntimeCompletions(): Record<
  string,
  { label: string; kind: vscode.CompletionItemKind; detail?: string }[]
> {
  const completions: Record<
    string,
    { label: string; kind: vscode.CompletionItemKind; detail?: string }[]
  > = {};

  for (const classDef of APY_RUNTIME_SCHEMA.classes) {
    // Handle nested classes (exceptions.*)
    if ("nestedClasses" in classDef && classDef.nestedClasses) {
      completions[classDef.name] = classDef.nestedClasses.map((nested) => ({
        label: nested.name,
        kind: vscode.CompletionItemKind.Class,
      }));
    }

    // Handle regular members
    if (classDef.members.length > 0) {
      const completionKey =
        CLASS_TO_COMPLETION_KEY[classDef.name] || classDef.name;

      completions[completionKey] = classDef.members.map((member) => ({
        label: member.name,
        kind: getCompletionKind(member.kind),
        detail: extractCompletionDetail(member),
      }));
    }
  }

  return completions;
}

// Pre-generated completions for performance
export const APY_RUNTIME_COMPLETIONS = generateApyRuntimeCompletions();

// -------------------- Signature Lookup --------------------

export function getApyRuntimeSignature(dottedPath: string): string | null {
  const parts = dottedPath.split(".");

  // Handle Response() constructor
  if (parts.length === 1 && parts[0] === "Response") {
    const responseClass = APY_RUNTIME_SCHEMA.classes.find(
      (c) => c.name === "Response",
    );
    if (responseClass && "initParams" in responseClass && responseClass.initParams) {
      return `Response(${responseClass.initParams.join(", ")})`;
    }
    return null;
  }

  // Handle exception classes like exceptions.Http400()
  if (parts.length === 2 && parts[0] === "exceptions") {
    const exceptionsClass = APY_RUNTIME_SCHEMA.classes.find(
      (c) => c.name === "exceptions",
    );
    if (
      exceptionsClass &&
      "nestedClasses" in exceptionsClass &&
      exceptionsClass.nestedClasses
    ) {
      const nested = exceptionsClass.nestedClasses.find(
        (nc) => nc.name === parts[1],
      );
      if (nested) {
        return `${nested.name}()`;
      }
    }
    return null;
  }

  // Build the completion key from parts
  // e.g., ["reve", "auth", "encode_password"] -> key="reve.auth", member="encode_password"
  // e.g., ["logger", "info"] -> key="logger", member="info"
  if (parts.length < 2) return null;

  const memberName = parts[parts.length - 1];

  // Try progressively shorter keys
  for (let i = parts.length - 1; i >= 1; i--) {
    const key = parts.slice(0, i).join(".");
    const completions = APY_RUNTIME_COMPLETIONS[key];
    if (completions) {
      const member = completions.find((m) => m.label === memberName);
      if (member && member.detail) {
        return member.detail;
      }
    }
  }

  // Special case: look up in the schema directly for full signature
  const classNameMap: Record<string, string> = {
    logger: "_Logger",
    reve: "Reve",
    "reve.request": "_Request",
    "reve.auth": "_Auth",
    "reve.database": "_Database",
    "reve.database.expressions": "_Expressions",
    "reve.database.exceptions": "_SQLExceptions",
    "reve.utils": "_Utils",
    "reve.libs": "_Libs",
    "reve.ai": "_AI",
  };

  for (let i = parts.length - 1; i >= 1; i--) {
    const key = parts.slice(0, i).join(".");
    const className = classNameMap[key];
    if (className) {
      const classDef = APY_RUNTIME_SCHEMA.classes.find(
        (c) => c.name === className,
      );
      if (classDef) {
        const member = classDef.members.find((m) => m.name === memberName);
        if (member && member.kind === "method") {
          return member.pythonSignature
            .replace(/def\s+/, "")
            .replace(/\(self,?\s*/, "(")
            .replace(/\s*:\s*\.\.\.\s*$/, "");
        }
      }
    }
  }

  return null;
}

// Runtime root identifiers for quick check
export const APY_RUNTIME_ROOTS = new Set([
  "reve",
  "logger",
  "exceptions",
  "Response",
  "Http400",
  "Http401",
  "Http403",
  "Http404",
  "Http409",
  "Http410",
  "Http500",
  "AccessToken",
  "RefreshToken",
]);
