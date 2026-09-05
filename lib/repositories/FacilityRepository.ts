import { supabase } from '../supabaseClient';

export class FacilityRepository {
  /**
   * Discovers facilities based on intelligent filtering, ignoring rigid hierarchy.
   */
  static async discoverFacilities(filters: {
    service?: string;
    department?: string;
    maxDistanceKm?: number; // Requires PostGIS natively, simulated here for now
    requireAvailableCapacity?: boolean;
  }) {
    let query = supabase
      .from('facilities')
      .select(`
        id,
        name,
        type,
        district,
        is_active,
        departments!inner ( name, description )
      `)
      .eq('is_active', true);

    if (filters.department) {
      query = query.ilike('departments.name', `%${filters.department}%`);
    }

    // In a full PostGIS implementation, we'd add:
    // .rpc('nearby_facilities', { lat, long, max_distance: filters.maxDistanceKm })
    
    const { data, error } = await query;

    if (error) throw new Error(`Facility Discovery Error: ${error.message}`);
    
    return data;
  }
}
