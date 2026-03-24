-- Migration: hold_detections
-- Description: Store hold detection results for climbing routes

-- Table: hold_detections
CREATE TABLE IF NOT EXISTS hold_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    holds JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of detected holds with bbox, center, confidence, type
    total_holds INTEGER NOT NULL DEFAULT 0,
    processing_time_ms FLOAT,
    image_width INTEGER,
    image_height INTEGER,
    beta_analysis TEXT,  -- AI-generated beta suggestions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_hold_detections_user_id ON hold_detections(user_id);
CREATE INDEX IF NOT EXISTS idx_hold_detections_route_id ON hold_detections(route_id);
CREATE INDEX IF NOT EXISTS idx_hold_detections_created_at ON hold_detections(created_at DESC);

-- RLS Policies
ALTER TABLE hold_detections ENABLE ROW LEVEL SECURITY;

-- Users can view their own hold detections
CREATE POLICY "Users can view own hold detections"
    ON hold_detections FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own hold detections
CREATE POLICY "Users can insert own hold detections"
    ON hold_detections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own hold detections
CREATE POLICY "Users can update own hold detections"
    ON hold_detections FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own hold detections
CREATE POLICY "Users can delete own hold detections"
    ON hold_detections FOR DELETE
    USING (auth.uid() = user_id);

-- Add holds_detected column to routes table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'holds_detected'
    ) THEN
        ALTER TABLE routes ADD COLUMN holds_detected JSONB DEFAULT NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'hold_detection_id'
    ) THEN
        ALTER TABLE routes ADD COLUMN hold_detection_id UUID REFERENCES hold_detections(id);
    END IF;
END $$;

-- Comment on table
COMMENT ON TABLE hold_detections IS 'Stores AI-detected climbing holds from route images';
COMMENT ON COLUMN hold_detections.holds IS 'JSON array of detected holds: [{id, type, confidence, bbox: [x1,y1,x2,y2], center: [x,y], area}]';
