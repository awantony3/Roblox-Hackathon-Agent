import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Reflection } from "../types.js";

interface Lesson { goal: string; reflection: Reflection; validated: boolean; createdAt: string }

export class LessonStore {
  constructor(private root = path.resolve("backend/data/sessions")) {}

  private file(sessionId: string) { return path.join(this.root, `${sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`); }

  async load(sessionId: string): Promise<Lesson[]> {
    try { return JSON.parse(await readFile(this.file(sessionId), "utf8")); } catch { return []; }
  }

  async append(sessionId: string, lesson: Lesson) {
    await mkdir(this.root, { recursive: true });
    const lessons = await this.load(sessionId);
    lessons.push(lesson);
    await writeFile(this.file(sessionId), JSON.stringify(lessons.slice(-20), null, 2));
  }
}
