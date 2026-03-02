export interface League {
  id: string;
  realm?: string;
  description?: string;
  registerAt?: string;
  startAt?: string;
  endAt?: string;
}

export interface PoeItem {
  id: string;
  typeLine: string;
  name?: string;
  icon?: string;
  ilvl?: number;
  identified?: boolean;
  frameType?: number;
  rarity?: string;
  stackSize?: number;
  note?: string;
  [key: string]: unknown;
}

export interface StashItem extends PoeItem {
  x?: number;
  y?: number;
  inventoryId?: string;
}

export interface StashTab {
  id: string;
  index: number;
  name: string;
  type?: string;
  color?: string;
  folder?: boolean;
  items?: StashItem[];
}
