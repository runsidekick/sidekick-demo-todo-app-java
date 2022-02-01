package com.runsidekick.todo.service;

import com.runsidekick.todo.entity.TodoEntity;
import com.runsidekick.todo.model.Todo;
import com.runsidekick.todo.repository.TodoRepository;
import org.springframework.stereotype.Service;

import javax.persistence.EntityNotFoundException;
import java.util.List;
import java.util.stream.Collectors;

/**
 * @author tolgatakir
 */
@Service
public class TodoServiceImpl implements TodoService {

    private final TodoRepository repository;

    public TodoServiceImpl(TodoRepository repository) {
        this.repository = repository;
    }

    @Override
    public List<Todo> findTodos() {
        List<TodoEntity> entities = repository.findAll();
        return entities.stream()
                .map(entity -> new Todo(entity.getId(), entity.getTitle(), entity.isCompleted()))
                .collect(Collectors.toList());
    }

    @Override
    public Todo addTodo(Todo request) {
        TodoEntity entity = new TodoEntity();
        entity.setTitle(request.getTitle());
        entity.setCompleted(request.isCompleted());
        entity = repository.save(entity);
        return new Todo(entity.getId(), entity.getTitle(), entity.isCompleted());
    }

    @Override
    public Todo updateTodo(Long id, Todo request) {
        TodoEntity entity = getTodoEntity(id);
        entity.setTitle(request.getTitle());
        entity.setCompleted(request.isCompleted());
        entity = repository.save(entity);
        return new Todo(entity.getId(), entity.getTitle(), entity.isCompleted());
    }

    @Override
    public void deleteTodo(Long id) {
        repository.deleteById(id);
    }

    @Override
    public Todo duplicateTodo(Long id) {
        TodoEntity duplicatedEntity = getTodoEntity(id);
        TodoEntity entity = new TodoEntity();
        entity.setTitle(duplicatedEntity.getTitle());
        entity.setCompleted(duplicatedEntity.isCompleted());
        entity = repository.save(entity);
        return new Todo(entity.getId(), entity.getTitle(), entity.isCompleted());
    }

    @Override
    public void clearCompletedTodo() {
        List<TodoEntity> completedTodos = repository.findByCompletedIsTrue();
        repository.deleteAllInBatch(completedTodos);
    }

    private TodoEntity getTodoEntity(Long id) {
        return repository.findById(id).orElseThrow(() ->
                new EntityNotFoundException("Todo not found for given id."));
    }
}
