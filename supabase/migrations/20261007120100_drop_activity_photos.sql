-- re_form platform · activity_photos is replaced by activity_media (20261007120000).
-- A separate step so the old code keeps working until the new one is deployed.
drop table public.activity_photos;
