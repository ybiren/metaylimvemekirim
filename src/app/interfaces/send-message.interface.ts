export interface ISendMessagePayload {
  fromId: number;
  toId: number;
  body: string;
  sentAt: string; // ISO datetime
}

export interface ISendMessageResponse {
  id: string;
  createdAt: string; // ISO
}