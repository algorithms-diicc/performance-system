import React, { useState } from 'react';

function TaskPage({ onTaskToggle }) {
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    
    const tasks = [
        {
            id: 'lcs',
            title: 'Text input',
            description: ``
        },
        {
            id: 'camm',
            title: 'Numerical input',
            description: ``
        }
    ];
    
    

    const handleRadioChange = (taskId, isChecked) => {
        if (isChecked) {
            setSelectedTaskId(taskId);
            onTaskToggle(taskId, isChecked);
        } else {
            setSelectedTaskId(null);
            onTaskToggle(null, isChecked);
        }
    }

    return (
        <div className="container mt-4">
            {tasks.map(task => (
                <div className="card mb-3" key={task.id}>
                    <div className="card-body">
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="taskToggle"
                                id={task.id}
                                checked={selectedTaskId === task.id}
                                onChange={(e) => handleRadioChange(task.id, e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor={task.id}>
                                {task.title} {selectedTaskId !== task.id && '(Expand for description)'}
                            </label>
                        </div>
                        {selectedTaskId === task.id && (
                            <div className="mt-2">
                                <p>{task.description}</p>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default TaskPage;
