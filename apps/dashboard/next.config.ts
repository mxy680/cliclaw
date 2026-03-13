import type { NextConfig } from "next";
import path from "path";

const authSrc = path.resolve(__dirname, "../../packages/auth/src");

// Suppress url.parse() deprecation warning from googleapis internals (DEP0169)
const originalEmit = process.emit.bind(process);
process.emit = function (event: string, ...args: unknown[]) {
  if (
    event === "warning" &&
    typeof (args[0] as any)?.message === "string" &&
    (args[0] as any).message.includes("url.parse()")
  ) {
    return false;
  }
  return originalEmit(event, ...args);
} as typeof process.emit;

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@cliclaw/auth"],
  webpack(config) {
    config.resolve.plugins = config.resolve.plugins || [];
    // Rewrite .js imports to .ts within the auth package source
    config.resolve.plugins.push({
      apply(resolver: any) {
        resolver
          .getHook("resolve")
          .tapAsync("AuthJsToTs", (request: any, context: any, callback: any) => {
            if (
              request.request?.endsWith(".js") &&
              request.path?.startsWith(authSrc)
            ) {
              const newRequest = {
                ...request,
                request: request.request.replace(/\.js$/, ".ts"),
              };
              resolver.doResolve(
                resolver.getHook("resolve"),
                newRequest,
                null,
                context,
                callback,
              );
              return;
            }
            callback();
          });
      },
    });
    return config;
  },
};

export default nextConfig;
