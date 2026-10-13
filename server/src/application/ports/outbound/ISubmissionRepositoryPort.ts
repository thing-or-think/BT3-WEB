import { Submission } from '../../../domain/evaluation/entities/Submission';

export interface ISubmissionRepositoryPort {
  saveSubmission(submission: Submission): void;
  findById(id: string): Submission | null;
  findRecent(limit: number): Submission[];
}
