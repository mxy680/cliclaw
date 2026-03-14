import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getSlides(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("gslides");
  }
  return google.slides({ version: "v1", auth: client });
}

function getDrive(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  return google.drive({ version: "v3", auth: client });
}

export async function handleList(
  clientManager: OAuthClientManager,
  account: string,
  maxResults: number,
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.presentation' and trashed = false",
      pageSize: maxResults,
      fields: "files(id, name, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc",
    });
    outputJson(res.data.files ?? []);
  } catch (err) {
    outputError("list_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleGet(
  clientManager: OAuthClientManager,
  account: string,
  presentationId: string,
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const slides = getSlides(clientManager, tokenKey);
    const res = await slides.presentations.get({ presentationId });
    const data = res.data;
    outputJson({
      presentationId: data.presentationId,
      title: data.title,
      locale: data.locale,
      slideCount: data.slides?.length ?? 0,
      slides: data.slides?.map((s, i) => ({
        index: i,
        objectId: s.objectId,
        elementCount: s.pageElements?.length ?? 0,
      })),
    });
  } catch (err) {
    outputError("get_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleCreate(
  clientManager: OAuthClientManager,
  account: string,
  title: string,
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const slides = getSlides(clientManager, tokenKey);
    const res = await slides.presentations.create({
      requestBody: { title },
    });
    outputJson({
      presentationId: res.data.presentationId,
      title: res.data.title,
      slideCount: res.data.slides?.length ?? 0,
    });
  } catch (err) {
    outputError("create_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDelete(
  clientManager: OAuthClientManager,
  account: string,
  presentationId: string,
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    await drive.files.delete({ fileId: presentationId });
    outputJson({ success: true, presentationId });
  } catch (err) {
    outputError("delete_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleGetSlide(
  clientManager: OAuthClientManager,
  account: string,
  presentationId: string,
  slideIndex: number,
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const slides = getSlides(clientManager, tokenKey);
    const res = await slides.presentations.get({ presentationId });
    const allSlides = res.data.slides ?? [];
    if (slideIndex < 0 || slideIndex >= allSlides.length) {
      outputError("invalid_index", `Slide index ${slideIndex} out of range (0-${allSlides.length - 1})`);
    }
    const slide = allSlides[slideIndex];
    outputJson({
      objectId: slide.objectId,
      index: slideIndex,
      elements: slide.pageElements?.map((el) => ({
        objectId: el.objectId,
        type: el.shape ? "shape" : el.image ? "image" : el.table ? "table" : el.video ? "video" : "other",
        title: el.title,
        description: el.description,
        size: el.size,
        transform: el.transform,
        text: el.shape?.text?.textElements?.map((te) => te.textRun?.content).filter(Boolean).join("") ?? null,
      })),
    });
  } catch (err) {
    if ((err as Error).message?.includes("out of range")) throw err;
    outputError("get_slide_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleAddSlide(
  clientManager: OAuthClientManager,
  account: string,
  presentationId: string,
  layout?: string,
  insertionIndex?: number,
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const slides = getSlides(clientManager, tokenKey);
    const objectId = `slide_${Date.now()}`;
    const request: any = {
      objectId,
    };
    if (layout) {
      request.slideLayoutReference = { predefinedLayout: layout };
    }
    if (insertionIndex !== undefined) {
      request.insertionIndex = insertionIndex;
    }
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{ createSlide: request }],
      },
    });
    outputJson({ success: true, objectId });
  } catch (err) {
    outputError("add_slide_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDeleteSlide(
  clientManager: OAuthClientManager,
  account: string,
  presentationId: string,
  slideObjectId: string,
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const slides = getSlides(clientManager, tokenKey);
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{ deleteObject: { objectId: slideObjectId } }],
      },
    });
    outputJson({ success: true, objectId: slideObjectId });
  } catch (err) {
    outputError("delete_slide_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleAddText(
  clientManager: OAuthClientManager,
  account: string,
  presentationId: string,
  slideObjectId: string,
  text: string,
  opts: { x?: number; y?: number; width?: number; height?: number; fontSize?: number },
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const slides = getSlides(clientManager, tokenKey);
    const boxId = `textbox_${Date.now()}`;
    const x = opts.x ?? 100;
    const y = opts.y ?? 100;
    const width = opts.width ?? 400;
    const height = opts.height ?? 50;

    const requests: any[] = [
      {
        createShape: {
          objectId: boxId,
          shapeType: "TEXT_BOX",
          elementProperties: {
            pageObjectId: slideObjectId,
            size: {
              width: { magnitude: width, unit: "PT" },
              height: { magnitude: height, unit: "PT" },
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              translateX: x,
              translateY: y,
              unit: "PT",
            },
          },
        },
      },
      {
        insertText: {
          objectId: boxId,
          text,
          insertionIndex: 0,
        },
      },
    ];

    if (opts.fontSize) {
      requests.push({
        updateTextStyle: {
          objectId: boxId,
          style: {
            fontSize: { magnitude: opts.fontSize, unit: "PT" },
          },
          textRange: { type: "ALL" },
          fields: "fontSize",
        },
      });
    }

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });
    outputJson({ success: true, objectId: boxId });
  } catch (err) {
    outputError("add_text_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleAddImage(
  clientManager: OAuthClientManager,
  account: string,
  presentationId: string,
  slideObjectId: string,
  imageUrl: string,
  opts: { x?: number; y?: number; width?: number; height?: number },
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const slides = getSlides(clientManager, tokenKey);
    const imgId = `image_${Date.now()}`;
    const x = opts.x ?? 100;
    const y = opts.y ?? 100;
    const width = opts.width ?? 300;
    const height = opts.height ?? 200;

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            createImage: {
              objectId: imgId,
              url: imageUrl,
              elementProperties: {
                pageObjectId: slideObjectId,
                size: {
                  width: { magnitude: width, unit: "PT" },
                  height: { magnitude: height, unit: "PT" },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: x,
                  translateY: y,
                  unit: "PT",
                },
              },
            },
          },
        ],
      },
    });
    outputJson({ success: true, objectId: imgId });
  } catch (err) {
    outputError("add_image_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleAddShape(
  clientManager: OAuthClientManager,
  account: string,
  presentationId: string,
  slideObjectId: string,
  shapeType: string,
  opts: { x?: number; y?: number; width?: number; height?: number },
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const slides = getSlides(clientManager, tokenKey);
    const shapeId = `shape_${Date.now()}`;
    const x = opts.x ?? 100;
    const y = opts.y ?? 100;
    const width = opts.width ?? 200;
    const height = opts.height ?? 200;

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            createShape: {
              objectId: shapeId,
              shapeType: shapeType,
              elementProperties: {
                pageObjectId: slideObjectId,
                size: {
                  width: { magnitude: width, unit: "PT" },
                  height: { magnitude: height, unit: "PT" },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: x,
                  translateY: y,
                  unit: "PT",
                },
              },
            },
          },
        ],
      },
    });
    outputJson({ success: true, objectId: shapeId });
  } catch (err) {
    outputError("add_shape_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDuplicateSlide(
  clientManager: OAuthClientManager,
  account: string,
  presentationId: string,
  slideObjectId: string,
): Promise<void> {
  const tokenKey = `gslides:${account}`;
  try {
    const slides = getSlides(clientManager, tokenKey);
    const newId = `slide_dup_${Date.now()}`;
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            duplicateObject: {
              objectId: slideObjectId,
              objectIds: { [slideObjectId]: newId },
            },
          },
        ],
      },
    });
    outputJson({ success: true, originalId: slideObjectId, newId });
  } catch (err) {
    outputError("duplicate_slide_failed", err instanceof Error ? err.message : String(err));
  }
}
