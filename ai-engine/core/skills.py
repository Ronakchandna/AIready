"""Curated skill taxonomy with synonyms and whole-word matching.

Matching is done on the ORIGINAL (not stripped) text, so C++, C#, Node.js, CI/CD survive,
and "java" never matches inside "javascript".
"""
import re
from typing import Dict, List

# canonical name -> (category, rarity 1-10, aliases)
_RAW = {
    # languages
    "Python": ("Language", 3, ["python", "python3"]),
    "Java": ("Language", 3, ["java"]),
    "JavaScript": ("Language", 2, ["javascript", "js", "ecmascript", "es6"]),
    "TypeScript": ("Language", 4, ["typescript"]),
    "C++": ("Language", 5, ["c++", "cpp"]),
    "C#": ("Language", 4, ["c#", "csharp", "c sharp"]),
    "C": ("Language", 4, ["c programming", "c language"]),
    "Go": ("Language", 6, ["golang", "go lang", "go programming"]),
    "Rust": ("Language", 8, ["rust"]),
    "Kotlin": ("Language", 5, ["kotlin"]),
    "Swift": ("Language", 5, ["swift"]),
    "PHP": ("Language", 3, ["php"]),
    "Ruby": ("Language", 4, ["ruby"]),
    "Scala": ("Language", 7, ["scala"]),
    "R": ("Language", 5, ["r programming", "r language", "rstudio"]),
    "SQL": ("Language", 2, ["sql", "t-sql", "pl/sql"]),
    "Bash": ("Language", 3, ["bash", "shell scripting", "shell script"]),
    "HTML": ("Web", 1, ["html", "html5"]),
    "CSS": ("Web", 1, ["css", "css3"]),
    # web frameworks
    "React": ("Frontend", 3, ["react", "react.js", "reactjs"]),
    "Next.js": ("Frontend", 5, ["next.js", "nextjs", "next js"]),
    "Angular": ("Frontend", 4, ["angular", "angularjs"]),
    "Vue": ("Frontend", 4, ["vue", "vue.js", "vuejs"]),
    "Redux": ("Frontend", 4, ["redux"]),
    "Tailwind CSS": ("Frontend", 3, ["tailwind", "tailwindcss", "tailwind css"]),
    "Bootstrap": ("Frontend", 2, ["bootstrap"]),
    "Node.js": ("Backend", 3, ["node.js", "nodejs", "node js", "node"]),
    "Express": ("Backend", 3, ["express.js", "expressjs", "express"]),
    "Django": ("Backend", 4, ["django"]),
    "Flask": ("Backend", 3, ["flask"]),
    "FastAPI": ("Backend", 5, ["fastapi", "fast api"]),
    "Spring Boot": ("Backend", 5, ["spring boot", "springboot", "spring framework"]),
    ".NET": ("Backend", 4, [".net", "dotnet", "asp.net"]),
    "Laravel": ("Backend", 4, ["laravel"]),
    "GraphQL": ("Backend", 5, ["graphql"]),
    "REST API": ("Backend", 2, ["rest api", "rest apis", "restful", "restful api", "restful apis"]),
    "Microservices": ("Architecture", 5, ["microservices", "microservice"]),
    # data / ml
    "Machine Learning": ("AI/ML", 5, ["machine learning", "ml"]),
    "Deep Learning": ("AI/ML", 7, ["deep learning"]),
    "NLP": ("AI/ML", 7, ["nlp", "natural language processing"]),
    "Computer Vision": ("AI/ML", 7, ["computer vision"]),
    "TensorFlow": ("AI/ML", 6, ["tensorflow"]),
    "PyTorch": ("AI/ML", 7, ["pytorch"]),
    "scikit-learn": ("AI/ML", 5, ["scikit-learn", "sklearn", "scikit learn"]),
    "spaCy": ("AI/ML", 6, ["spacy"]),
    "LLM": ("AI/ML", 8, ["llm", "llms", "large language model", "large language models", "generative ai", "genai"]),
    "LangChain": ("AI/ML", 8, ["langchain"]),
    "Pandas": ("Data", 3, ["pandas"]),
    "NumPy": ("Data", 3, ["numpy"]),
    "Data Analysis": ("Data", 3, ["data analysis", "data analytics", "data analyst"]),
    "Data Visualization": ("Data", 4, ["data visualization", "data visualisation"]),
    "Power BI": ("Data", 4, ["power bi", "powerbi"]),
    "Tableau": ("Data", 4, ["tableau"]),
    "Excel": ("Data", 1, ["excel", "ms excel", "microsoft excel"]),
    "Spark": ("Data", 7, ["apache spark", "pyspark", "spark"]),
    "Hadoop": ("Data", 6, ["hadoop"]),
    "Kafka": ("Data", 7, ["kafka", "apache kafka"]),
    "Airflow": ("Data", 7, ["airflow"]),
    "ETL": ("Data", 5, ["etl", "data pipeline", "data pipelines"]),
    # databases
    "PostgreSQL": ("Database", 4, ["postgresql", "postgres", "psql"]),
    "MySQL": ("Database", 3, ["mysql"]),
    "MongoDB": ("Database", 4, ["mongodb", "mongo"]),
    "Redis": ("Database", 5, ["redis"]),
    "SQLite": ("Database", 2, ["sqlite"]),
    "Oracle": ("Database", 4, ["oracle db", "oracle database", "oracle"]),
    "Elasticsearch": ("Database", 6, ["elasticsearch", "elastic search"]),
    "Firebase": ("Database", 3, ["firebase", "firestore"]),
    "Supabase": ("Database", 4, ["supabase"]),
    "Database Design": ("Database", 3, ["database design", "schema design", "data modeling", "data modelling"]),
    # cloud / devops
    "AWS": ("Cloud", 4, ["aws", "amazon web services", "ec2", "s3", "lambda"]),
    "Azure": ("Cloud", 4, ["azure", "microsoft azure"]),
    "Google Cloud": ("Cloud", 5, ["gcp", "google cloud", "google cloud platform"]),
    "Docker": ("DevOps", 4, ["docker", "containerization"]),
    "Kubernetes": ("DevOps", 7, ["kubernetes", "k8s"]),
    "Terraform": ("DevOps", 7, ["terraform"]),
    "CI/CD": ("DevOps", 4, ["ci/cd", "cicd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"]),
    "Jenkins": ("DevOps", 4, ["jenkins"]),
    "GitHub Actions": ("DevOps", 4, ["github actions"]),
    "Linux": ("DevOps", 3, ["linux", "unix"]),
    "Nginx": ("DevOps", 4, ["nginx"]),
    "Git": ("Tools", 1, ["git", "github", "gitlab", "bitbucket", "version control"]),
    "Jira": ("Tools", 2, ["jira"]),
    "Postman": ("Tools", 2, ["postman"]),
    "Figma": ("Tools", 3, ["figma"]),
    # mobile
    "React Native": ("Mobile", 5, ["react native"]),
    "Flutter": ("Mobile", 5, ["flutter"]),
    "Android": ("Mobile", 4, ["android"]),
    "iOS": ("Mobile", 5, ["ios"]),
    # practices
    "Agile": ("Practice", 1, ["agile", "scrum", "kanban"]),
    "Unit Testing": ("Practice", 3, ["unit testing", "unit tests", "pytest", "jest", "junit", "tdd", "test driven development"]),
    "Selenium": ("Practice", 4, ["selenium"]),
    "System Design": ("Practice", 6, ["system design", "distributed systems", "scalability", "scalable systems"]),
    "OOP": ("Practice", 2, ["oop", "object oriented", "object-oriented"]),
    "Data Structures": ("Practice", 3, ["data structures", "algorithms", "dsa"]),
    "Cybersecurity": ("Security", 6, ["cybersecurity", "cyber security", "information security", "penetration testing"]),
    "OAuth/JWT": ("Security", 5, ["oauth", "oauth2", "jwt", "authentication"]),
    "Blockchain": ("Other", 7, ["blockchain", "solidity", "web3"]),
    # soft skills
    "Communication": ("Soft skill", 1, ["communication skills", "communication", "communicator"]),
    "Leadership": ("Soft skill", 2, ["leadership", "team lead", "led a team", "mentoring", "mentored"]),
    "Problem Solving": ("Soft skill", 1, ["problem solving", "problem-solving", "analytical skills"]),
    "Teamwork": ("Soft skill", 1, ["teamwork", "collaboration", "collaborative", "cross-functional"]),
    "Project Management": ("Soft skill", 3, ["project management", "project manager", "stakeholder management"]),
}

SKILLS: Dict[str, dict] = {
    name: {"category": cat, "rarity": rar, "aliases": aliases} for name, (cat, rar, aliases) in _RAW.items()
}

_ALIAS_TO_SKILL: Dict[str, str] = {}
for _name, _info in SKILLS.items():
    # aliases are listed explicitly (ambiguous names such as "Go", "C", "R" are NOT auto-added)
    for _a in _info["aliases"]:
        _ALIAS_TO_SKILL.setdefault(_a.lower(), _name)

# longest alias first so "spring boot" wins over "spring"
_ALIASES_SORTED = sorted(_ALIAS_TO_SKILL, key=len, reverse=True)
_PATTERN = re.compile(
    r"(?<![A-Za-z0-9+#.])(" + "|".join(re.escape(a) for a in _ALIASES_SORTED) + r")(?![A-Za-z0-9+#]|\.[A-Za-z0-9])",
    re.IGNORECASE,
)


def extract_skills(text: str) -> List[str]:
    """Return canonical skill names found in text, ordered by first occurrence."""
    found: Dict[str, int] = {}
    for m in _PATTERN.finditer(text or ""):
        name = _ALIAS_TO_SKILL[m.group(1).lower()]
        found.setdefault(name, m.start())
    return sorted(found, key=found.get)


def skill_rarity(name: str) -> int:
    return SKILLS.get(name, {}).get("rarity", 3)


def skill_category(name: str) -> str:
    return SKILLS.get(name, {}).get("category", "Other")
