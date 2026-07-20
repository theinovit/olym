import Image, { type StaticImageData } from "next/image";
import { Box, FileCode2 } from "lucide-react";
import { siClickhouse, siMeilisearch, siMinio, siQdrant, type SimpleIcon } from "simple-icons";

import adonisOriginal from "devicon/icons/adonisjs/adonisjs-original.svg";
import blazorOriginal from "devicon/icons/blazor/blazor-original.svg";
import djangoPlain from "devicon/icons/django/django-plain.svg";
import laravelOriginal from "devicon/icons/laravel/laravel-original.svg";
import mariadbOriginal from "devicon/icons/mariadb/mariadb-original.svg";
import mongodbOriginal from "devicon/icons/mongodb/mongodb-original.svg";
import mongodbPlain from "devicon/icons/mongodb/mongodb-plain.svg";
import mysqlOriginal from "devicon/icons/mysql/mysql-original.svg";
import nextOriginal from "devicon/icons/nextjs/nextjs-original.svg";
import nextPlain from "devicon/icons/nextjs/nextjs-plain.svg";
import nuxtOriginal from "devicon/icons/nuxtjs/nuxtjs-original.svg";
import nuxtPlain from "devicon/icons/nuxtjs/nuxtjs-plain.svg";
import phoenixOriginal from "devicon/icons/phoenix/phoenix-original.svg";
import postgresOriginal from "devicon/icons/postgresql/postgresql-original.svg";
import postgresPlain from "devicon/icons/postgresql/postgresql-plain.svg";
import rabbitOriginal from "devicon/icons/rabbitmq/rabbitmq-original.svg";
import railsPlain from "devicon/icons/rails/rails-plain.svg";
import redisOriginal from "devicon/icons/redis/redis-original.svg";
import redisPlain from "devicon/icons/redis/redis-plain.svg";
import remixOriginal from "devicon/icons/remix/remix-original.svg";
import svelteOriginal from "devicon/icons/svelte/svelte-original.svg";
import sveltePlain from "devicon/icons/svelte/svelte-plain.svg";
import symfonyOriginal from "devicon/icons/symfony/symfony-original.svg";

import { cn } from "@/lib/utils";

type DeviconPair = { original: StaticImageData; plain?: StaticImageData };
const devicons: Record<string, DeviconPair> = {
  nextjs: { original: nextOriginal, plain: nextPlain }, nuxt: { original: nuxtOriginal, plain: nuxtPlain }, nuxtjs: { original: nuxtOriginal, plain: nuxtPlain },
  sveltekit: { original: svelteOriginal, plain: sveltePlain }, remix: { original: remixOriginal }, adonisjs: { original: adonisOriginal },
  django: { original: djangoPlain, plain: djangoPlain }, rails: { original: railsPlain, plain: railsPlain }, laravel: { original: laravelOriginal },
  symfony: { original: symfonyOriginal }, blazor: { original: blazorOriginal }, phoenix: { original: phoenixOriginal },
  postgresql: { original: postgresOriginal, plain: postgresPlain }, postgres: { original: postgresOriginal, plain: postgresPlain }, tpl_postgres: { original: postgresOriginal, plain: postgresPlain },
  mysql: { original: mysqlOriginal }, mariadb: { original: mariadbOriginal }, mongodb: { original: mongodbOriginal, plain: mongodbPlain },
  redis: { original: redisOriginal, plain: redisPlain }, tpl_redis: { original: redisOriginal, plain: redisPlain }, rabbitmq: { original: rabbitOriginal },
};
const simpleIcons: Record<string, SimpleIcon> = { minio: siMinio, tpl_minio: siMinio, meilisearch: siMeilisearch, qdrant: siQdrant, clickhouse: siClickhouse };

export function BrandIcon({ name, officialColor = false, className }: { name: string; officialColor?: boolean; className?: string }) {
  const slug = name.toLowerCase();
  const devicon = devicons[slug];
  if (devicon) return <Image src={officialColor ? devicon.original : devicon.plain ?? devicon.original} width={24} height={24} alt="" aria-hidden className={cn("size-4 object-contain", !officialColor && !devicon.plain && "grayscale", className)} />;
  const simpleIcon = simpleIcons[slug];
  if (simpleIcon) return <svg aria-label={simpleIcon.title} role="img" viewBox="0 0 24 24" className={cn("size-4", className)} fill={officialColor ? `#${simpleIcon.hex}` : "currentColor"}><path d={simpleIcon.path} /></svg>;
  const Fallback = slug === "static" ? FileCode2 : Box;
  return <Fallback aria-hidden className={cn("size-4", className)} />;
}
