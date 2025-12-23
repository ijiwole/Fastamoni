export const numericTransformer = {
  to: (value?: number) => value,
  from: (value?: string) => (value ? parseFloat(value) : 0),
};

