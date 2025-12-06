import { z } from 'zod';

// 市场选项概率
export const ProbabilitySchema = z.object({
  option: z.string(),
  probability: z.number().min(0).max(1),
});

export type Probability = z.infer<typeof ProbabilitySchema>;

// Polymarket 市场数据
export const MarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  description: z.string().optional(),
  endDate: z.string().optional(),
  volume: z.number().optional(),
  probabilities: z.array(ProbabilitySchema).optional(),
  url: z.string().optional(),
});

export type Market = z.infer<typeof MarketSchema>;

// Polymarket 完整数据
export const PolymarketDataSchema = z.object({
  markets: z.array(MarketSchema),
  fetchedAt: z.string().optional(),
});

export type PolymarketData = z.infer<typeof PolymarketDataSchema>;

// 每日摘要条目
export const SummaryItemSchema = z.object({
  title: z.string(),
  content: z.string(),
  volume: z.number().optional(),
  probabilities: z.array(ProbabilitySchema).optional(),
  marketId: z.string().optional(),
});

export type SummaryItem = z.infer<typeof SummaryItemSchema>;

// 每日摘要
export const DailySummarySchema = z.object({
  date: z.string(),
  summary: z.string(),
  items: z.array(SummaryItemSchema).max(10),
  wordCount: z.number(),
  updatedAt: z.string(),
});

export type DailySummary = z.infer<typeof DailySummarySchema>;

// API 响应
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: DailySummarySchema.optional(),
  error: z.string().optional(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

