import { useCallback, useEffect, useState } from 'react';
import { createConversation, deleteConversation, listConversations } from '../../api/conversations';
import type { ConversationSummary } from '../../api/contract';
import { describeError } from '../../api/http';

const PAGE_SIZE = 30;

/**
 * 当前用户的会话列表：首次加载、新建、删除与继续加载。
 * 会话正文由 useSqlWorkspace 按 ID 单独读取，避免列表保存大段 SQL。
 */
export function useConversations() {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listConversations(PAGE_SIZE);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const page = await listConversations(PAGE_SIZE, nextCursor);
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setLoading(false);
    }
  }, [loading, nextCursor]);

  const create = useCallback(async (connectionId: number, title: string): Promise<ConversationSummary> => {
    const created = await createConversation({ connectionId, title });
    setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    return created;
  }, []);

  const remove = useCallback(async (id: number) => {
    await deleteConversation(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return { items, nextCursor, loading, error, reload, loadMore, create, remove };
}
