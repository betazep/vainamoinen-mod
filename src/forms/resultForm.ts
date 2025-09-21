import type { Context, FormField, FormFunction, FormOnSubmitEvent, FormOnSubmitEventHandler } from '@devvit/public-api';
import { Devvit } from '@devvit/public-api';

export type ResultFormData = {
  title?: string;
  description?: string;
  acceptLabel?: string;
  cancelLabel?: string;
  fields?: FormField[];
};

const form: FormFunction<ResultFormData> = (data: ResultFormData) => ({
  fields: data.fields ?? [],
  title: data.title ?? 'Results',
  acceptLabel: data.acceptLabel ?? 'Close',
  cancelLabel: data.cancelLabel ?? 'Cancel',
  description: data.description,
});

const formHandler: FormOnSubmitEventHandler<object> = async (_event: FormOnSubmitEvent<object>, _context: Context) => {
  // Read-only form; no action needed on submit.
};

export const resultForm = Devvit.createForm(form, formHandler);
