import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getForms(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("forms");
  }
  return google.forms({ version: "v1", auth: client });
}

export async function handleQuestions(
  clientManager: OAuthClientManager,
  account: string,
  formId: string,
): Promise<void> {
  const tokenKey = `forms:${account}`;
  try {
    const forms = getForms(clientManager, tokenKey);
    const res = await forms.forms.get({ formId });
    const items = res.data.items ?? [];
    const questions = items
      .filter((item) => item.questionItem)
      .map((item) => ({
        itemId: item.itemId,
        title: item.title,
        description: item.description,
        questionId: item.questionItem?.question?.questionId,
        required: item.questionItem?.question?.required ?? false,
        type: getQuestionType(item.questionItem?.question),
      }));
    outputJson(questions);
  } catch (err) {
    outputError("questions_failed", err instanceof Error ? err.message : String(err));
  }
}

function getQuestionType(question: unknown): string {
  if (!question || typeof question !== "object") return "unknown";
  const q = question as Record<string, unknown>;
  if (q.choiceQuestion) return "choice";
  if (q.textQuestion) return "text";
  if (q.scaleQuestion) return "scale";
  if (q.dateQuestion) return "date";
  if (q.timeQuestion) return "time";
  if (q.fileUploadQuestion) return "fileUpload";
  return "unknown";
}

export async function handleAddQuestion(
  clientManager: OAuthClientManager,
  account: string,
  formId: string,
  title: string,
  type: string,
  required: boolean,
  options?: string[],
  index?: number,
): Promise<void> {
  const tokenKey = `forms:${account}`;
  try {
    const forms = getForms(clientManager, tokenKey);

    const question: Record<string, unknown> = { required };

    switch (type) {
      case "text":
        question.textQuestion = { paragraph: false };
        break;
      case "paragraph":
        question.textQuestion = { paragraph: true };
        break;
      case "choice":
        question.choiceQuestion = {
          type: "RADIO",
          options: (options ?? ["Option 1"]).map((o) => ({ value: o })),
        };
        break;
      case "checkbox":
        question.choiceQuestion = {
          type: "CHECKBOX",
          options: (options ?? ["Option 1"]).map((o) => ({ value: o })),
        };
        break;
      case "dropdown":
        question.choiceQuestion = {
          type: "DROP_DOWN",
          options: (options ?? ["Option 1"]).map((o) => ({ value: o })),
        };
        break;
      case "scale":
        question.scaleQuestion = { low: 1, high: 5 };
        break;
      case "date":
        question.dateQuestion = {};
        break;
      case "time":
        question.timeQuestion = {};
        break;
      default:
        question.textQuestion = { paragraph: false };
    }

    const res = await forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: [
          {
            createItem: {
              item: {
                title,
                questionItem: { question },
              },
              location: { index: index ?? 0 },
            },
          },
        ],
      },
    });

    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("add_question_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleUpdateQuestion(
  clientManager: OAuthClientManager,
  account: string,
  formId: string,
  itemIndex: number,
  title?: string,
  required?: boolean,
): Promise<void> {
  const tokenKey = `forms:${account}`;
  try {
    const forms = getForms(clientManager, tokenKey);

    // First get the current form to find the item
    const current = await forms.forms.get({ formId });
    const items = current.data.items ?? [];
    if (itemIndex >= items.length) {
      outputError("update_question_failed", `Item index ${itemIndex} out of range (form has ${items.length} items)`);
    }

    const item = items[itemIndex];
    const updateMasks: string[] = [];

    if (title !== undefined) {
      item.title = title;
      updateMasks.push("title");
    }
    if (required !== undefined && item.questionItem?.question) {
      item.questionItem.question.required = required;
      updateMasks.push("questionItem.question.required");
    }

    if (updateMasks.length === 0) {
      outputError("update_question_failed", "No fields to update.");
    }

    const res = await forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: [
          {
            updateItem: {
              item,
              location: { index: itemIndex },
              updateMask: updateMasks.join(","),
            },
          },
        ],
      },
    });

    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("update_question_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDeleteQuestion(
  clientManager: OAuthClientManager,
  account: string,
  formId: string,
  itemIndex: number,
): Promise<void> {
  const tokenKey = `forms:${account}`;
  try {
    const forms = getForms(clientManager, tokenKey);
    const res = await forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: [
          {
            deleteItem: {
              location: { index: itemIndex },
            },
          },
        ],
      },
    });
    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("delete_question_failed", err instanceof Error ? err.message : String(err));
  }
}
