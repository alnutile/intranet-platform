ALTER TABLE app_wine_tracker_wines ADD COLUMN region TEXT;
ALTER TABLE app_wine_tracker_wines ADD COLUMN grape TEXT;
ALTER TABLE app_wine_tracker_wines ADD COLUMN price REAL;
ALTER TABLE app_wine_tracker_wines ADD COLUMN purchase_date TEXT;
ALTER TABLE app_wine_tracker_wines ADD COLUMN country TEXT;
ALTER TABLE app_wine_tracker_wines ADD COLUMN color TEXT CHECK (color IN ('red', 'white', 'rosé', 'sparkling', 'dessert', 'orange'));
