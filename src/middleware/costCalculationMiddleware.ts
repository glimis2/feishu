import { createMiddleware } from "langchain";

/**
 * 模型费用统计中间件
 * 自动计算 tokens + 费用
 */
export function costCalculationMiddleware() {
  return createMiddleware({
    name: "cost-calculation-middleware",
    wrapModelCall: async (request, handler) => {
      const result = await handler(request);
      /**
       * AIMessage中包含具体的费用，直接序列化即可
       */
      return result;
    },
  });
}
