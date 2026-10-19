"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CatalogItem } from "@/lib/types";

interface ItemImageProps {
  item: CatalogItem;
  sizes: string;
  className?: string;
  emojiClassName?: string;
}

export function ItemImage({ item, sizes, className, emojiClassName }: ItemImageProps) {
  const [failed, setFailed] = useState(false);

  if (!item.imageUrl || failed) {
    return (
      <span aria-hidden="true" className={emojiClassName ?? "text-3xl"}>
        {item.emoji}
      </span>
    );
  }

  return (
    <Image
      src={item.imageUrl}
      alt=""
      fill
      sizes={sizes}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
