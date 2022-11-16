# sidekick-demo-todo-app-java

## Running todo app with sidekick agent locally
Todo app is a [Spring Boot](https://spring.io/guides/gs/spring-boot) application built using [Maven](https://spring.io/guides/gs/maven/). You can build a jar file and run it from the command line:

```

git clone https://github.com/runsidekick/sidekick-demo-todo-java-app.git
cd sidekick-demo-todo-app-java
./mvnw package
```
| WARNING: Docker must be installed and running to run tests! <br/>You can skip tests running ```./mvnw package -DskipTests=true```command |
|-------------------------------------------------------------------------------------------------------------------------------------|
```
java -javaagent:sidekick-agent-bootstrap.jar -Dsidekick.apikey=<YOUR-API-KEY> -Dsidekick.agent.application.name=sidekick-demo-todo-app-java -Dsidekick.agent.application.stage=demo -Dsidekick.agent.application.version=1.0.0 -jar target/*.jar
```

You can then access todo app here: http://localhost:8080/