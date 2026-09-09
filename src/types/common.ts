import type { ReasonCode, ExplanationBlock } from '../constants/reasonCodes';

export type DataConfidence = 'low' | 'medium' | 'high';

export type ISODateString = string;
export type ISODateTimeString = string;

export type ScoredOutput = {
  score: number;
  confidence: DataConfidence;
  reasonCodes: ReasonCode[];
  explanation?: ExplanationBlock;
};

export type BodyLocation =
  | 'head'
  | 'neck'
  | 'shoulder_left'
  | 'shoulder_right'
  | 'elbow_left'
  | 'elbow_right'
  | 'wrist_left'
  | 'wrist_right'
  | 'chest'
  | 'upper_back'
  | 'lower_back'
  | 'hip_left'
  | 'hip_right'
  | 'knee_left'
  | 'knee_right'
  | 'ankle_left'
  | 'ankle_right'
  | 'foot_left'
  | 'foot_right';
