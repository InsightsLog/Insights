"use client";

import { useState } from "react";
import Link from "next/link";
import { openApiSpec, rateLimitTiers } from "@/lib/api/openapi";

/**
 * Available API endpoints from the OpenAPI spec.
 */
type EndpointPath = keyof typeof openApiSpec.paths;

interface EndpointInfo {
  path: EndpointPath;
  method: "GET";
  summary: string;
  description: string;
  tag: string;
  operationId: string;
  parameters: ParameterInfo[];
}

interface ParameterInfo {
  name: string;
  in: "path" | "query";
  description: string;
  required: boolean;
  type: string;
  default?: string | number | boolean;
  minimum?: number;
  maximum?: number;
}

/**
 * Extracts endpoint information from the OpenAPI spec.
 */
function getEndpoints(): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];

  for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
    if (pathItem.get) {
      const op = pathItem.get;
      const params: ParameterInfo[] = [];

      for (const param of op.parameters || []) {
        if ("$ref" in param) {
          // Resolve $ref to actual parameter
          const refPath = param.$ref.replace("#/components/parameters/", "");
          const refParam =
            openApiSpec.components.parameters[
              refPath as keyof typeof openApiSpec.components.parameters
            ];
          if (refParam) {
            params.push({
              name: refParam.name,
              in: refParam.in,
              description: refParam.description,
              // Query parameters from $ref are typically optional in this API spec
              required: "required" in refParam ? refParam.required === true : false,
              type: refParam.schema.type,
              default: "default" in refParam.schema ? refParam.schema.default : undefined,
              minimum: "minimum" in refParam.schema ? refParam.schema.minimum : undefined,
              maximum: "maximum" in refParam.schema ? refParam.schema.maximum : undefined,
            });
          }
        } else {
          // For inline parameters, check required property
          // Note: Path parameters should always have required: true per OpenAPI spec
          const isRequired = "required" in param && param.required === true;
          params.push({
            name: param.name,
            in: param.in,
            description: param.description ?? "",
            required: isRequired,
            type: param.schema.type,
            default: "default" in param.schema ? param.schema.default : undefined,
            minimum: "minimum" in param.schema ? param.schema.minimum : undefined,
            maximum: "maximum" in param.schema ? param.schema.maximum : undefined,
          });
        }
      }

      // Validate operation has required fields
      const tags = op.tags ?? [];
      endpoints.push({
        path: path as EndpointPath,
        method: "GET",
        summary: op.summary ?? "No summary available",
        description: op.description ?? "No description available",
        tag: tags[0] ?? "Other",
        operationId: op.operationId,
        parameters: params,
      });
    }
  }

  return endpoints;
}

/**
 * Generates code examples for an endpoint.
 */
function generateCodeExamples(
  endpoint: EndpointInfo,
  paramValues: Record<string, string>
): { curl: string; javascript: string; python: string } {
  const baseUrl = "https://your-domain.com/api/v1";
  let path = endpoint.path as string;

  // Replace path parameters
  for (const param of endpoint.parameters) {
    if (param.in === "path") {
      const value = paramValues[param.name] || `{${param.name}}`;
      path = path.replace(`{${param.name}}`, value);
    }
  }

  // Build query string
  const queryParams = endpoint.parameters
    .filter((p) => p.in === "query" && paramValues[p.name])
    .map((p) => `${p.name}=${encodeURIComponent(paramValues[p.name])}`)
    .join("&");

  const fullUrl = queryParams ? `${baseUrl}${path}?${queryParams}` : `${baseUrl}${path}`;

  // cURL example
  const curl = `curl -X GET "${fullUrl}" \\
  -H "Authorization: Bearer mc_your_api_key_here" \\
  -H "Content-Type: application/json"`;

  // JavaScript/fetch example
  const javascript = `const response = await fetch("${fullUrl}", {
  method: "GET",
  headers: {
    "Authorization": "Bearer mc_your_api_key_here",
    "Content-Type": "application/json"
  }
});

const data = await response.json();
console.log(data);`;

  // Python example
  const python = `import requests

url = "${fullUrl}"
headers = {
    "Authorization": "Bearer mc_your_api_key_here",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)
data = response.json()
print(data)`;

  return { curl, javascript, python };
}

type CodeLanguage = "curl" | "javascript" | "python";

/**
 * API Documentation client component.
 * Provides an interactive API explorer with code examples.
 *
 * Task: T315 - Add API documentation page
 */
export function ApiDocsClient() {
  const endpoints = getEndpoints();
  
  // Provide a fallback endpoint if none are available (should not happen with valid OpenAPI spec)
  const defaultEndpoint: EndpointInfo = endpoints[0] ?? {
    path: "/indicators" as EndpointPath,
    method: "GET",
    summary: "No endpoints available",
    description: "The API specification could not be loaded.",
    tag: "Other",
    operationId: "unknown",
    parameters: [],
  };
  
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointInfo>(
    defaultEndpoint
  );
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>("curl");
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "authentication"
  );

  const codeExamples = generateCodeExamples(selectedEndpoint, paramValues);

  const handleParamChange = (name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleEndpointSelect = (endpoint: EndpointInfo) => {
    setSelectedEndpoint(endpoint);
    setParamValues({});
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  // Group endpoints by tag
  const endpointsByTag = endpoints.reduce<Record<string, EndpointInfo[]>>(
    (acc, endpoint) => {
      if (!acc[endpoint.tag]) {
        acc[endpoint.tag] = [];
      }
      acc[endpoint.tag].push(endpoint);
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Calendar
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            API Documentation
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {openApiSpec.info.title} v{openApiSpec.info.version} — Programmatic
            access to economic indicator data
          </p>
        </div>

        {/* Quick Start Guide */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={() => toggleSection("authentication")}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              🔑 Authentication
            </h2>
            <svg
              className={`h-5 w-5 text-zinc-500 transition-transform ${
                expandedSection === "authentication" ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {expandedSection === "authentication" && (
            <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                All API endpoints require authentication using an API key.
                Include your API key in the{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                  Authorization
                </code>{" "}
                header as a Bearer token:
              </p>
              <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
                <code className="text-zinc-800 dark:text-zinc-200">
                  Authorization: Bearer mc_your_api_key_here
                </code>
              </pre>
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                Generate API keys from your{" "}
                <Link
                  href="/settings/api-keys"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Account Settings
                </Link>
                .
              </p>
            </div>
          )}
        </div>

        {/* Rate Limits */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={() => toggleSection("ratelimits")}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              ⏱️ Rate Limits
            </h2>
            <svg
              className={`h-5 w-5 text-zinc-500 transition-transform ${
                expandedSection === "ratelimits" ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {expandedSection === "ratelimits" && (
            <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                Rate limits are enforced per API key based on your subscription
                tier:
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Plan
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Requests/Minute
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Requests/Month
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {Object.values(rateLimitTiers).map((tier) => (
                      <tr key={tier.name}>
                        <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {tier.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {tier.requestsPerMinute}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {tier.requestsPerMonth === -1
                            ? "Unlimited"
                            : tier.requestsPerMonth.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                Rate limit headers are included in all responses:
              </p>
              <ul className="mt-2 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
                <li>
                  <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                    X-RateLimit-Limit
                  </code>
                  : Maximum requests allowed
                </li>
                <li>
                  <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                    X-RateLimit-Remaining
                  </code>
                  : Requests remaining in window
                </li>
                <li>
                  <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                    X-RateLimit-Reset
                  </code>
                  : Unix timestamp when limit resets
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Error Handling */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={() => toggleSection("errors")}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              ⚠️ Error Handling
            </h2>
            <svg
              className={`h-5 w-5 text-zinc-500 transition-transform ${
                expandedSection === "errors" ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {expandedSection === "errors" && (
            <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                All errors return a JSON object with an{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                  error
                </code>{" "}
                field:
              </p>
              <pre className="mb-4 overflow-x-auto rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
                <code className="text-zinc-800 dark:text-zinc-200">
                  {`{
  "error": "Error message here",
  "code": "ERROR_CODE"
}`}
                </code>
              </pre>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Common HTTP status codes:
              </p>
              <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
                <li>
                  <strong>400</strong>: Bad Request (invalid parameters)
                </li>
                <li>
                  <strong>401</strong>: Unauthorized (missing or invalid API
                  key)
                </li>
                <li>
                  <strong>403</strong>: Forbidden (insufficient permissions)
                </li>
                <li>
                  <strong>404</strong>: Not Found (resource doesn&apos;t exist)
                </li>
                <li>
                  <strong>429</strong>: Too Many Requests (rate limit exceeded)
                </li>
                <li>
                  <strong>500</strong>: Internal Server Error
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Interactive API Explorer */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Endpoint List */}
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                🔍 API Explorer
              </h2>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {Object.entries(endpointsByTag).map(([tag, tagEndpoints]) => (
                <div key={tag}>
                  <div className="bg-zinc-50 px-4 py-2 dark:bg-zinc-800">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {tag}
                    </h3>
                  </div>
                  {tagEndpoints.map((endpoint) => (
                    <button
                      key={endpoint.operationId}
                      onClick={() => handleEndpointSelect(endpoint)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                        selectedEndpoint.operationId === endpoint.operationId
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : ""
                      }`}
                    >
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
                        {endpoint.method}
                      </span>
                      <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
                        {endpoint.path}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Endpoint Details & Code Examples */}
          <div className="space-y-6">
            {/* Selected Endpoint Details */}
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
                    {selectedEndpoint.method}
                  </span>
                  <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    /api/v1{selectedEndpoint.path}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {selectedEndpoint.summary}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedEndpoint.description}
                </p>
              </div>
            </div>

            {/* Parameters */}
            {selectedEndpoint.parameters.length > 0 && (
              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Parameters
                  </h3>
                </div>
                <div className="space-y-4 p-4">
                  {selectedEndpoint.parameters.map((param) => (
                    <div key={param.name}>
                      <div className="mb-1 flex items-center gap-2">
                        <label
                          htmlFor={param.name}
                          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          {param.name}
                        </label>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          {param.in}
                        </span>
                        {param.required && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            required
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        id={param.name}
                        placeholder={
                          param.default !== undefined
                            ? `Default: ${param.default}`
                            : param.description
                        }
                        value={paramValues[param.name] || ""}
                        onChange={(e) =>
                          handleParamChange(param.name, e.target.value)
                        }
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {param.description}
                        {param.minimum !== undefined &&
                          ` (min: ${param.minimum})`}
                        {param.maximum !== undefined &&
                          ` (max: ${param.maximum})`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Code Examples */}
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Code Examples
                </h3>
                <div className="flex gap-1">
                  {(["curl", "javascript", "python"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setCodeLanguage(lang)}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        codeLanguage === lang
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {lang === "curl"
                        ? "cURL"
                        : lang === "javascript"
                          ? "JavaScript"
                          : "Python"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <pre className="overflow-x-auto p-4 text-sm">
                  <code className="text-zinc-800 dark:text-zinc-200">
                    {codeExamples[codeLanguage]}
                  </code>
                </pre>
                <button
                  onClick={() => copyToClipboard(codeExamples[codeLanguage])}
                  className="absolute right-2 top-2 rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* OpenAPI Spec Link */}
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            📄 OpenAPI Specification
          </h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Download the complete OpenAPI 3.0 specification for use with API
            clients, code generators, and documentation tools.
          </p>
          <a
            href="/api/openapi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download openapi.json
          </a>
        </div>
      </main>
    </div>
  );
}
