export interface Cv {
  id: string;
  title: string;
  template: string;
  templateLabel?: string;
  status: string;
  isDefault?: boolean;
  contentJson?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CvTemplateOption {
  id: string;
  name: string;
  description: string;
  pages: number;
}
