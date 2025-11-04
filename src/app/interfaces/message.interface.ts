export interface IMessage {
  id: string;
  fromId: number;
  toId: number;      // always equals meId in this store
  fromName: string;
  toName: string;      // always equals meId in this store
  body: string;
  sentAt: string;    // ISO
  readAt?: string | null;
}