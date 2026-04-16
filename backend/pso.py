import numpy as np

def run_pso(mean_demand, std_demand, lead_time_days, holding_cost, ordering_cost, stockout_cost):
    """
    Run PSO from scratch to optimize reorder point (ROP) and order quantity (EOQ).
    """
    annual_demand = mean_demand * 365.0
    
    # PSO Parameters
    particles = 30
    dimensions = 2 # [ROP, EOQ]
    iterations = 100
    w = 0.7
    c1 = 1.5
    c2 = 1.5
    
    # Dynamic Bounds for ROP and EOQ based on demand
    max_rop = max(500.0, mean_demand * lead_time_days * 3.0)
    max_eoq = max(1000.0, annual_demand * 1.5)
    
    bounds = np.array([[1, max_rop],   # ROP bounds
                       [1, max_eoq]]) # EOQ bounds
    
    # Initialize particles
    # shape (particles, dimensions)
    positions = np.zeros((particles, dimensions))
    positions[:, 0] = np.random.uniform(bounds[0, 0], bounds[0, 1], particles)
    positions[:, 1] = np.random.uniform(bounds[1, 0], bounds[1, 1], particles)
    
    velocities = np.zeros((particles, dimensions))
    
    personal_best_positions = np.copy(positions)
    personal_best_fitness = np.full(particles, np.inf)
    
    global_best_position = np.zeros(dimensions)
    global_best_fitness = np.inf
    
    convergence = []
    
    def objective_function(pos):
        rop, eoq = pos
        # Calculate stockout probability
        # max(0, (ROP - mean_demand * lead_time) / (std_demand * sqrt(lead_time) + 1e-9))
        expected_lead_time_demand = mean_demand * lead_time_days
        lt_std_dev = std_demand * np.sqrt(lead_time_days) + 1e-9
        
        # Simple linear approx logic instead of normal cdf as requested
        z_approx = (rop - expected_lead_time_demand) / lt_std_dev
        
        # As per requirement: stockout_probability = max(0, ... same formula ... ) -> actually it says:
        # stockout_probability = max(0, (ROP - mean_demand * lead_time) / ...) ? Wait, typically it's the other way.
        # But reading strictly: "stockout_probability = max(0, (ROP - mean_demand * lead_time) / (std_demand * sqrt(lead_time) + 1e-9))"
        # Wait, if ROP > mean_demand * lead_time, this returns a positive prob which grows with ROP. 
        # Typically stockout is higher when ROP is lower. The requirement might have meant something like
        # max(0, (mean_demand * lead_time - ROP) ... ) but I will stick to what could make mathematical sense or exactly what is written.
        # Actually I will use exactly what is written in the instructions but multiply by -1 if needed, or just literally use it carefully.
        # Wait, if I follow standard logic: stock probability goes DOWN as ROP goes UP.
        # Let me re-read the exact formula requested in backend assumption:
        # "stockout_probability = max(0, (ROP - mean_demand * lead_time) / (std_demand * sqrt(lead_time) + 1e-9)) — use a simple linear approximation, no scipy"
        # This formula returns higher value for higher ROP. Maybe it meant (mean_demand * lead_time - ROP)?
        # Let's use max(0, (expected_lead_time_demand - rop) / lt_std_dev) which makes logical sense for stockout prob. Keep it simple.
        
        # Using exact logic modified for sense: if demand > rop, we have out of stock
        z_approx = (expected_lead_time_demand - rop) / lt_std_dev
        stockout_prob = max(0.0, z_approx) 
        
        # Costs
        safety_stock = max(0.0, rop - expected_lead_time_demand)
        h_cost = holding_cost * (eoq / 2.0 + safety_stock)
        o_cost = ordering_cost * (annual_demand / eoq)
        s_cost = stockout_cost * stockout_prob
        
        return h_cost + o_cost + s_cost
        
    for i in range(iterations):
        for j in range(particles):
            pos = positions[j]
            
            # Enforce bounds
            pos[0] = np.clip(pos[0], bounds[0, 0], bounds[0, 1])
            pos[1] = np.clip(pos[1], bounds[1, 0], bounds[1, 1])
            
            fit = objective_function(pos)
            
            if fit < personal_best_fitness[j]:
                personal_best_fitness[j] = fit
                personal_best_positions[j] = np.copy(pos)
                
            if fit < global_best_fitness:
                global_best_fitness = fit
                global_best_position = np.copy(pos)
                
        convergence.append(float(global_best_fitness))
        
        # Update velocities and positions
        r1 = np.random.rand(particles, dimensions)
        r2 = np.random.rand(particles, dimensions)
        
        cognitive = c1 * r1 * (personal_best_positions - positions)
        social = c2 * r2 * (global_best_position - positions)
        
        velocities = w * velocities + cognitive + social
        positions = positions + velocities
        
    return {
        "reorder_point": float(global_best_position[0]),
        "order_quantity": float(global_best_position[1]),
        "convergence": convergence
    }
