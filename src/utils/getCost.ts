export function getCost(result){
    return result.messages.reduce((acc, item) => {
    const usage = item?.response_metadata?.usage;
    if (!usage) return acc;

    return {
      prompt_tokens: acc.prompt_tokens + (usage.prompt_tokens || 0),
      completion_tokens: acc.completion_tokens + (usage.completion_tokens || 0),
      total_tokens: acc.total_tokens + (usage.total_tokens || 0),
    };
  }, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })
}